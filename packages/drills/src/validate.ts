import { LAYOUTS, type LayoutId, type Platform } from "@cellrush/engine";
import { createRun, modeLabel, runKey, scoreRun, tick, timeLimitMs, unpackEvent, type RunEvent, type RunMode, type RunState, type Score } from "./run";
import { isRankable } from "./ranked";
import { SCENARIOS, scenarioById } from "./scenarios";
import { DAILY_TASKS, dailyNumber, dailySeed, summarize, utcDate, type ShareSummary } from "./share";

/** What the client sends. It never includes a score: the server computes it. */
export interface RunSubmission {
  v: 1;
  seed: number;
  mode: RunMode;
  platform: Platform;
  layout: LayoutId;
  /** UTC date the run was played (YYYY-MM-DD). */
  today: string;
  daily: boolean;
  events: RunEvent[];
}

export type Flag = "inhuman-speed" | "robotic-timing" | "impossible-tpm";

export interface Validation {
  ok: boolean;
  /** Why the run was refused outright (malformed, wrong seed, unfinished…). */
  reason?: string;
  score?: Score;
  /** Server-computed summary (squares, efficiency…), the same shape as a share link. */
  summary?: ShareSummary;
  /** Suspicious but well-formed: stored, never ranked. */
  flags: Flag[];
  ranked: boolean;
  dailyNumber?: number;
}

export const LIMITS = {
  maxEvents: 6000,
  /** Median gap between keystrokes below this (ms) over a run is not human. */
  minMedianGapMs: 35,
  /** Gaps this regular (std dev, ms) over many keys look scripted. */
  minGapStdDevMs: 4,
  /** Two completed drills per second sustained is not human. */
  maxTpm: 120,
  /** A daily submitted just after UTC midnight still counts for the day it was played. */
  dailyGraceMs: 15 * 60_000,
} as const;

/** Modes that can be submitted. Learn mode is practice and never ranked. */
export const RANKED_MODES = new Set(["30s", "60s", "120s", "10t", "25t", "50t", ...SCENARIOS.map((s) => `sc-${s.id}`)]);
const modeKey = (m: RunMode) => (m && typeof m === "object" ? modeLabel(m) : "");
const refuse = (reason: string): Validation => ({ ok: false, reason, flags: [], ranked: false });

/** Build the submission from a finished run (client side). */
export function toSubmission(run: RunState, daily: boolean): RunSubmission {
  const c = run.config;
  return { v: 1, seed: c.seed, mode: c.mode, platform: c.platform, layout: c.layout, today: c.today, daily, events: [...run.events] };
}

function timingFlags(events: RunEvent[]): Flag[] {
  const t = events.map((e) => e.t);
  const gaps = t.slice(1).map((x, i) => x - t[i]!).filter((g) => g > 0 || g === 0);
  if (gaps.length < 20) return [];
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const sd = Math.sqrt(gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length);
  const flags: Flag[] = [];
  if (median < LIMITS.minMedianGapMs) flags.push("inhuman-speed");
  if (gaps.length >= 30 && sd < LIMITS.minGapStdDevMs) flags.push("robotic-timing");
  return flags;
}

/**
 * Server-side check of a run: replays every keystroke through the same engine the browser
 * used and recomputes the score. A client cannot send a score, only keys — and keys that
 * don't solve the drills simply don't score.
 */
export function validateRun(sub: RunSubmission, nowMs: number): Validation {
  if (sub?.v !== 1 || !Array.isArray(sub.events)) return refuse("malformed submission");
  if (!Number.isInteger(sub.seed) || sub.seed < 0 || sub.seed > 0xffffffff) return refuse("bad seed");
  if (!sub.mode || !RANKED_MODES.has(modeKey(sub.mode))) return refuse("bad mode");
  if (sub.platform !== "win" && sub.platform !== "mac") return refuse("bad platform");
  if (!(sub.layout in LAYOUTS)) return refuse("bad layout");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sub.today)) return refuse("bad date");
  if (sub.mode.kind === "scenario" && !isRankable(scenarioById(sub.mode.id)!, sub.platform)) {
    return refuse("practice only: this scenario uses a shortcut that is not on Microsoft's official list");
  }
  if (sub.events.length === 0 || sub.events.length > LIMITS.maxEvents) return refuse("bad event count");

  for (let i = 0; i < sub.events.length; i++) {
    const e = sub.events[i]!;
    if (typeof e.code !== "string" || typeof e.key !== "string" || e.code.length > 32 || e.key.length > 32) return refuse("bad event");
    if (!Number.isFinite(e.t) || e.t < 0 || (i > 0 && e.t < sub.events[i - 1]!.t)) return refuse("events out of order");
    if (!Number.isInteger(e.mods) || e.mods < 0 || e.mods > 15) return refuse("bad event");
  }
  if (sub.events[0]!.t !== 0) return refuse("events must start at t=0");

  const today = utcDate(nowMs);
  const yesterday = utcDate(nowMs - LIMITS.dailyGraceMs);
  if (sub.daily) {
    if (sub.today !== today && sub.today !== yesterday) return refuse("daily is not today's");
    if (sub.seed !== dailySeed(sub.today)) return refuse("daily seed mismatch");
    if (modeKey(sub.mode) !== `${DAILY_TASKS}t`) return refuse("daily mode mismatch");
  } else if (sub.today > today) {
    return refuse("date in the future");
  }

  // Replay. Times are relative to the first key; the run starts at t = 0.
  let run = createRun({ seed: sub.seed, mode: sub.mode, platform: sub.platform, layout: sub.layout, today: sub.today });
  for (const e of sub.events) {
    if (run.finishedAt !== null) break;
    run = runKey(run, unpackEvent(e), e.t).run;
  }
  const limit = timeLimitMs(sub.mode);
  if (limit !== null && sub.mode.kind === "time") run = tick(run, limit);
  // A scenario ends when it is solved, or at its time limit (then it is simply not completed).
  if (limit !== null && sub.mode.kind === "scenario" && run.finishedAt === null) run = tick(run, limit);
  if (run.finishedAt === null) return refuse("run not finished");
  const last = sub.events[sub.events.length - 1]!.t;
  if (limit !== null && last > limit + 1000) return refuse("events after the end of the run");

  const score = scoreRun(run);
  const flags = timingFlags(sub.events);
  if (score.tpm > LIMITS.maxTpm) flags.push("impossible-tpm");
  const daily = sub.daily ? dailyNumber(sub.today) : null;
  const label = modeLabel(sub.mode);
  return {
    ok: true,
    score,
    summary: summarize(run, { daily, mode: label }),
    flags,
    ranked: flags.length === 0 && score.completed > 0,
    dailyNumber: daily ?? undefined,
  };
}
