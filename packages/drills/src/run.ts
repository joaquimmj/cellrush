import { dispatchKey, isModifierOnly, type GridState, type LayoutId, type Platform, type RawKey, type ShortcutCategory } from "@cellrush/engine";
import { isReady } from "./data";
import { mixSeed, mulberry32 } from "./rng";
import { strokeCount } from "./strokes";
import { TASKS } from "./tasks";
import type { Task } from "./types";

export type RunMode = { kind: "time"; seconds: 30 | 60 | 120 } | { kind: "tasks"; count: 10 | 25 | 50 };

export interface RunConfig {
  seed: number;
  mode: RunMode;
  platform: Platform;
  layout: LayoutId;
  /** YYYY-MM-DD used by date drills. */
  today: string;
  categories?: readonly ShortcutCategory[];
  difficulties?: readonly (1 | 2 | 3)[];
  /** Drop drills whose shortcuts this browser cannot capture (capture matrix). */
  isPlayable?: (task: Task) => boolean;
}

/** One recorded keydown, relative to the run start. Enough to replay the run exactly (server check). */
export interface RunEvent {
  t: number;
  code: string;
  key: string;
  mods: number; // bit flags: 1 ctrl, 2 shift, 4 alt, 8 meta
}

export interface TaskResult {
  taskId: string;
  status: "done" | "skipped";
  ms: number;
  keystrokes: number;
  optimal: number;
}

export interface CurrentTask {
  task: Task;
  params: unknown;
  state: GridState;
  startedAt: number;
  keystrokes: number;
  optimal: number;
}

export interface RunState {
  config: RunConfig;
  pool: readonly Task[];
  index: number;
  current: CurrentTask | null;
  results: readonly TaskResult[];
  startedAt: number | null;
  finishedAt: number | null;
  events: readonly RunEvent[];
  undoCount: number;
}

export const packMods = (r: RawKey) => (r.ctrl ? 1 : 0) | (r.shift ? 2 : 0) | (r.alt ? 4 : 0) | (r.meta ? 8 : 0);
export const unpackEvent = (e: RunEvent): RawKey => ({
  code: e.code, key: e.key, ctrl: !!(e.mods & 1), shift: !!(e.mods & 2), alt: !!(e.mods & 4), meta: !!(e.mods & 8),
});

export function taskPool(config: RunConfig): Task[] {
  // A drill with no path on this platform (e.g. ribbon keytips on Mac) is left out.
  return TASKS.filter((t) => optimalFor(t, config) !== null).filter(
    (t) =>
      (!config.categories?.length || config.categories.includes(t.category)) &&
      (!config.difficulties?.length || config.difficulties.includes(t.difficulty)) &&
      (config.isPlayable?.(t) ?? true),
  );
}

/** Optimal path of a task kind for a platform, probed with a throwaway instance. */
function optimalFor(task: Task, config: RunConfig) {
  const inst = task.setup(mulberry32(1), { today: config.today });
  return task.optimal(inst.params)[config.platform];
}

function startTask(run: RunState, index: number, now: number): CurrentTask | null {
  if (!run.pool.length) return null;
  const rng = mulberry32(mixSeed(run.config.seed, index));
  // Pick a drill kind (no immediate repeats), then let it build its own sheet.
  let task = rng.pick(run.pool);
  if (run.current && run.pool.length > 1) while (task.id === run.current.task.id) task = rng.pick(run.pool);
  const inst = task.setup(rng, { today: run.config.today });
  const path = task.optimal(inst.params)[run.config.platform] ?? [];
  return { task, params: inst.params, state: inst.state, startedAt: now, keystrokes: 0, optimal: strokeCount(path) };
}

export function createRun(config: RunConfig): RunState {
  const base: RunState = {
    config, pool: taskPool(config), index: 0, current: null, results: [], startedAt: null, finishedAt: null, events: [], undoCount: 0,
  };
  return { ...base, current: startTask(base, 0, 0) };
}

const timeUp = (run: RunState, now: number) =>
  run.config.mode.kind === "time" && run.startedAt !== null && now - run.startedAt >= run.config.mode.seconds * 1000;

function finish(run: RunState, now: number): RunState {
  if (run.finishedAt !== null) return run;
  const end = run.config.mode.kind === "time" && run.startedAt !== null ? run.startedAt + run.config.mode.seconds * 1000 : now;
  return { ...run, finishedAt: Math.min(now, end) };
}

function advance(run: RunState, now: number, status: TaskResult["status"]): RunState {
  const cur = run.current!;
  const result: TaskResult = { taskId: cur.task.id, status, ms: now - cur.startedAt, keystrokes: cur.keystrokes, optimal: cur.optimal };
  const results = [...run.results, result];
  const next: RunState = { ...run, results, index: run.index + 1 };
  if (run.config.mode.kind === "tasks" && results.length >= run.config.mode.count) return finish(next, now);
  return { ...next, current: startTask(next, next.index, now) };
}

export interface KeyOutcome {
  run: RunState;
  handled: boolean;
  /** The current task was just completed. */
  completed?: boolean;
  shortcutId?: string;
}

/**
 * Feed one keydown at time `now` (ms, any monotonic clock). Pure: the same config + events
 * always produce the same run, which is what the server replays to validate a score.
 */
export function runKey(run0: RunState, raw: RawKey, now: number): KeyOutcome {
  let run = run0;
  if (run.finishedAt !== null || !run.current) return { run, handled: false };
  if (timeUp(run, now)) return { run: finish(run, now), handled: false };

  // The clock starts on the first key of any kind (a lone Alt can be the start of a keytip).
  if (run.startedAt === null) run = { ...run, startedAt: now, current: { ...run.current, startedAt: now } };
  const event: RunEvent = { t: now - run.startedAt!, code: raw.code, key: raw.key, mods: packMods(raw) };
  run = { ...run, events: [...run.events, event] };

  // Shift+Esc skips a drill (not an Excel shortcut, so it never collides with one).
  if (raw.code === "Escape" && raw.shift && !raw.ctrl && !raw.alt && !raw.meta) {
    return { run: advance(run, now, "skipped"), handled: true };
  }

  const cur = run.current!;
  const res = dispatchKey(cur.state, raw, { platform: run.config.platform, layout: run.config.layout });
  // Modifier keydowns are never keystrokes, not even the lone Alt that opens keytips: Alt+= presses
  // Alt first too, and must count the same as the chord (strokeCount skips "AltLeft" to match).
  const keystrokes = cur.keystrokes + (isModifierOnly(raw) ? 0 : 1);
  run = {
    ...run,
    current: { ...cur, state: res.state, keystrokes },
    undoCount: run.undoCount + (res.shortcutId === "undo" ? 1 : 0),
  };
  const st = res.state;
  const done = (cur.task.allowEditing || isReady(st)) && cur.task.check(st, cur.params);
  if (done) return { run: advance(run, now, "done"), handled: res.handled, completed: true, shortcutId: res.shortcutId };
  return { run, handled: res.handled, shortcutId: res.shortcutId };
}

/** Call on a timer: ends a timed run when the clock runs out. */
export function tick(run: RunState, now: number): RunState {
  return run.finishedAt === null && timeUp(run, now) ? finish(run, now) : run;
}

export interface Score {
  score: number;
  /** Completed tasks per minute. */
  tpm: number;
  /** Σ optimal keystrokes / Σ actual keystrokes over completed tasks, capped at 1. */
  efficiency: number;
  completed: number;
  skipped: number;
  elapsedMs: number;
  /** Std dev of completed task times (ms): lower is steadier. */
  consistencyMs: number;
  slowest: TaskResult[];
  undoCount: number;
}

export function scoreRun(run: RunState, now = run.finishedAt ?? run.startedAt ?? 0): Score {
  const done = run.results.filter((r) => r.status === "done");
  const elapsedMs = run.startedAt === null ? 0 : Math.max(1, (run.finishedAt ?? now) - run.startedAt);
  const minutes = elapsedMs / 60000;
  const tpm = minutes > 0 ? done.length / minutes : 0;
  const actual = done.reduce((s, r) => s + r.keystrokes, 0);
  const optimal = done.reduce((s, r) => s + r.optimal, 0);
  const efficiency = actual > 0 ? Math.min(1, optimal / actual) : 0;
  const mean = done.length ? done.reduce((s, r) => s + r.ms, 0) / done.length : 0;
  const consistencyMs = done.length ? Math.sqrt(done.reduce((s, r) => s + (r.ms - mean) ** 2, 0) / done.length) : 0;
  return {
    score: Math.round(tpm * efficiency * 100),
    tpm,
    efficiency,
    completed: done.length,
    skipped: run.results.length - done.length,
    elapsedMs,
    consistencyMs,
    slowest: [...done].sort((a, b) => b.ms - a.ms).slice(0, 3),
    undoCount: run.undoCount,
  };
}

/** 🟩 optimal · 🟨 done, not optimal · ⬛ skipped (Daily share card, §13). */
export const resultSquare = (r: TaskResult) => (r.status === "skipped" ? "⬛" : r.keystrokes <= r.optimal ? "🟩" : "🟨");
