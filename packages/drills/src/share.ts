import type { Platform } from "@cellrush/engine";
import { seedFromString } from "./rng";
import { resultSquare, scoreRun, type RunConfig, type RunState } from "./run";

// ───────────────────────────── Daily ─────────────────────────────

/** Daily #1 is this UTC day. Change only before launch (it renumbers every daily). */
export const DAILY_EPOCH = "2026-11-08";
export const DAILY_TASKS = 10;

const dayMs = 86_400_000;
const utcDay = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** UTC date (YYYY-MM-DD) of an instant. */
export const utcDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** 1 on the epoch day, 2 the next day… */
export const dailyNumber = (iso: string) => Math.round((utcDay(iso) - utcDay(DAILY_EPOCH)) / dayMs) + 1;

/** Same seed for everyone on a given UTC day. */
export const dailySeed = (iso: string) => seedFromString(`cellrush-daily-${iso}`);

/** Milliseconds until the next UTC midnight. */
export const msUntilNextDaily = (now: number) => dayMs - (now % dayMs);

export function dailyConfig(iso: string, platform: Platform, layout: RunConfig["layout"]): RunConfig {
  return { seed: dailySeed(iso), mode: { kind: "tasks", count: DAILY_TASKS }, platform, layout, today: iso };
}

// ───────────────────────────── Share text (§13) ─────────────────────────────

export interface ShareSummary {
  /** Daily number, or null for a normal run. */
  daily: number | null;
  /** Mode label for normal runs, e.g. "60s". */
  mode: string;
  platform: Platform;
  score: number;
  /** 0..100 */
  efficiency: number;
  /** Tasks per minute, one decimal. */
  tpm: number;
  completed: number;
  elapsedMs: number;
  /** 🟩🟨⬛ as letters: g = optimal, y = done not optimal, x = skipped. */
  squares: string;
  /** YYYY-MM-DD the run was played (UTC). */
  date: string;
}

const SQUARE_TO_LETTER: Record<string, string> = { "🟩": "g", "🟨": "y", "⬛": "x" };
const LETTER_TO_SQUARE: Record<string, string> = { g: "🟩", y: "🟨", x: "⬛" };

export function summarize(run: RunState, o: { daily: number | null; mode: string }): ShareSummary {
  const s = scoreRun(run);
  return {
    daily: o.daily,
    mode: o.mode,
    platform: run.config.platform,
    score: s.score,
    efficiency: Math.round(s.efficiency * 100),
    tpm: Math.round(s.tpm * 10) / 10,
    completed: s.completed,
    elapsedMs: s.elapsedMs,
    squares: run.results.map((r) => SQUARE_TO_LETTER[resultSquare(r)]).join(""),
    date: run.config.today,
  };
}

export const squaresOf = (s: ShareSummary) => [...s.squares].map((c) => LETTER_TO_SQUARE[c] ?? "").join("");

/**
 * The shareable text, exactly as in the brief:
 *
 *     cellrush daily #42 ⏱ 48.3s
 *     🟩🟩🟨🟩⬛🟩🟩🟩🟨🟩
 *     score 412 · efficiency 87%
 *     cellrush.app
 */
export function shareText(s: ShareSummary, app = "cellrush", domain = "cellrush.app"): string {
  const head = s.daily !== null ? `${app} daily #${s.daily}` : `${app} ${s.mode}`;
  return [
    `${head} ⏱ ${(s.elapsedMs / 1000).toFixed(1)}s`,
    squaresOf(s),
    `score ${s.score} · efficiency ${s.efficiency}%`,
    domain,
  ].join("\n");
}

// ───────────────────────────── Result links ─────────────────────────────
// No backend yet (M5): a result link carries its own data, base64url-encoded. It is NOT proof of a
// score — leaderboards will only list server-replayed runs.

// Available in browsers, Node ≥ 16, Deno and Vercel Edge; declared here because this package has no DOM lib.
declare function btoa(s: string): string;
declare function atob(s: string): string;

const b64url = {
  encode: (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  decode: (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))),
};

type Packed = [1, number | null, string, "w" | "m", number, number, number, number, number, string, string];

export function encodeResult(s: ShareSummary): string {
  const p: Packed = [1, s.daily, s.mode, s.platform === "mac" ? "m" : "w", s.score, s.efficiency, s.tpm, s.completed, s.elapsedMs, s.squares, s.date];
  return b64url.encode(JSON.stringify(p));
}

/** Decode and sanity-check a result id. Returns null for anything malformed. */
export function decodeResult(id: string): ShareSummary | null {
  try {
    const p = JSON.parse(b64url.decode(id)) as unknown;
    if (!Array.isArray(p) || p[0] !== 1 || p.length !== 11) return null;
    const [, daily, mode, plat, score, efficiency, tpm, completed, elapsedMs, squares, date] = p as Packed;
    const nums = [score, efficiency, tpm, completed, elapsedMs];
    if (nums.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < 0)) return null;
    if (daily !== null && (typeof daily !== "number" || daily < 1)) return null;
    if (typeof mode !== "string" || mode.length > 12 || (plat !== "w" && plat !== "m")) return null;
    if (typeof squares !== "string" || !/^[gyx]{0,60}$/.test(squares)) return null;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || efficiency > 100) return null;
    return { daily, mode, platform: plat === "m" ? "mac" : "win", score, efficiency, tpm, completed, elapsedMs, squares, date };
  } catch {
    return null;
  }
}
