import { describe, expect, it } from "vitest";
import type { RawKey } from "@cellrush/engine";
import { createRun, resultSquare, runKey, scoreRun, strokeToRaws, tick, unpackEvent, type RunConfig, type RunState } from "../src";

const cfg = (o: Partial<RunConfig> = {}): RunConfig => ({
  seed: 42, mode: { kind: "time", seconds: 60 }, platform: "win", layout: "us", today: "2026-11-08", ...o,
});

/** Play the current drill's optimal path, `gap` ms per keystroke. */
function playOne(run: RunState, now: number, gap = 100): { run: RunState; now: number } {
  const cur = run.current!;
  const before = run.results.length;
  const path = cur.task.optimal(cur.params)[run.config.platform]!;
  for (const raw of path.flatMap((s) => strokeToRaws(s, run.config.layout))) {
    now += gap;
    run = runKey(run, raw, now).run;
  }
  // Guard: a path that does not finish its drill would make the callers loop forever.
  if (run.finishedAt === null && run.results.length === before) throw new Error(`optimal path did not finish ${cur.task.id}`);
  return { run, now };
}

const esc: RawKey = { code: "Escape", key: "Escape", ctrl: false, shift: true, alt: false, meta: false };
const junk: RawKey = { code: "F12", key: "F12", ctrl: false, shift: false, alt: false, meta: false };

describe("run", () => {
  it("same seed → same drills and same sheets", () => {
    const a = createRun(cfg());
    const b = createRun(cfg());
    expect(a.current!.task.id).toBe(b.current!.task.id);
    expect(JSON.stringify(a.current!.state.sheets)).toBe(JSON.stringify(b.current!.state.sheets));
  });
  it("different seeds differ", () => {
    const ids = new Set([1, 2, 3, 4, 5, 6].map((seed) => createRun(cfg({ seed })).current!.task.id));
    expect(ids.size).toBeGreaterThan(1);
  });
  it("the clock starts on the first key, not at load", () => {
    let run = createRun(cfg());
    expect(run.startedAt).toBeNull();
    run = runKey(run, junk, 5000).run;
    expect(run.startedAt).toBe(5000);
  });
  it("completing a drill moves to the next and records it", () => {
    const { run } = playOne(createRun(cfg()), 0);
    expect(run.results).toHaveLength(1);
    expect(run.results[0]).toMatchObject({ status: "done" });
    expect(run.results[0]!.keystrokes).toBe(run.results[0]!.optimal);
    expect(run.index).toBe(1);
  });
  it("no drill repeats twice in a row", () => {
    let run = createRun(cfg({ mode: { kind: "tasks", count: 50 } }));
    let now = 0;
    for (let i = 0; i < 30; i++) ({ run, now } = playOne(run, now));
    for (let i = 1; i < run.results.length; i++) expect(run.results[i]!.taskId).not.toBe(run.results[i - 1]!.taskId);
  });
  it("Shift+Esc skips", () => {
    const run = runKey(createRun(cfg()), esc, 10).run;
    expect(run.results[0]).toMatchObject({ status: "skipped" });
  });
  it("task mode ends after N drills", () => {
    let run = createRun(cfg({ mode: { kind: "tasks", count: 10 } }));
    let now = 0;
    for (let i = 0; i < 100 && run.finishedAt === null; i++) ({ run, now } = playOne(run, now));
    expect(run.results).toHaveLength(10);
  });
  it("time mode ends at the limit; later keys are ignored", () => {
    let run = createRun(cfg({ mode: { kind: "time", seconds: 30 } }));
    run = runKey(run, junk, 1000).run;
    run = tick(run, 31_500);
    expect(run.finishedAt).toBe(31_000);
    const after = runKey(run, junk, 32_000);
    expect(after.handled).toBe(false);
    expect(after.run.events).toHaveLength(1);
  });
  it("a perfect bot scores 100% efficiency", () => {
    let run = createRun(cfg());
    let now = 0;
    while (now < 59_000) ({ run, now } = playOne(run, now, 150));
    run = tick(run, 61_000);
    const s = scoreRun(run);
    expect(s.efficiency).toBe(1);
    expect(s.completed).toBeGreaterThan(10);
    expect(s.score).toBe(Math.round(s.tpm * 100));
    expect(s.elapsedMs).toBe(60_000);
  });
  it("extra keystrokes lower efficiency", () => {
    let run = createRun(cfg());
    run = runKey(run, junk, 0).run; // a wasted key (F12 is not a shortcut)
    run = runKey(run, junk, 10).run;
    ({ run } = playOne(run, 20));
    const s = scoreRun(run, 5000);
    expect(s.efficiency).toBeLessThan(1);
  });
  it("events replay to the same result (what the server will do)", () => {
    let run = createRun(cfg());
    let now = 0;
    for (let i = 0; i < 8; i++) ({ run, now } = playOne(run, now, 120));
    let replay = createRun(cfg());
    for (const e of run.events) replay = runKey(replay, unpackEvent(e), e.t + 0).run;
    expect(replay.results.map((r) => [r.taskId, r.status, r.keystrokes])).toEqual(run.results.map((r) => [r.taskId, r.status, r.keystrokes]));
  });
  it("Mac runs never draw Windows-only ribbon drills", () => {
    const run = createRun(cfg({ platform: "mac" }));
    expect(run.pool.some((t) => t.category === "ribbon")).toBe(false);
    expect(createRun(cfg()).pool.some((t) => t.category === "ribbon")).toBe(true);
  });
  it("category and difficulty filters", () => {
    const run = createRun(cfg({ categories: ["formatting"], difficulties: [1] }));
    expect(run.pool.length).toBeGreaterThan(3);
    expect(run.pool.every((t) => t.category === "formatting" && t.difficulty === 1)).toBe(true);
  });
  it("share squares", () => {
    expect(resultSquare({ taskId: "x", status: "done", ms: 1, keystrokes: 2, optimal: 2 })).toBe("🟩");
    expect(resultSquare({ taskId: "x", status: "done", ms: 1, keystrokes: 5, optimal: 2 })).toBe("🟨");
    expect(resultSquare({ taskId: "x", status: "skipped", ms: 1, keystrokes: 0, optimal: 2 })).toBe("⬛");
  });
  it("undo presses are counted", () => {
    let run = createRun(cfg());
    run = runKey(run, { code: "KeyZ", key: "z", ctrl: true, shift: false, alt: false, meta: false }, 0).run;
    expect(run.undoCount).toBe(1);
  });
  it("keytip drills score 100% when played optimally", () => {
    let run = createRun(cfg({ categories: ["ribbon"] }));
    ({ run } = playOne(run, 0));
    expect(run.results[0]!.keystrokes).toBe(run.results[0]!.optimal);
  });
});

describe("keystroke counting", () => {
  it("Alt+= (Alt pressed first) costs the same as its optimal path", () => {
    let run = createRun(cfg({ categories: ["formulas"], seed: 3 }));
    for (let i = 0; i < 20 && run.current!.task.id !== "autosum-column"; i++) run = runKey(run, esc, i).run;
    expect(run.current!.task.id).toBe("autosum-column");
    const alt: RawKey = { code: "AltLeft", key: "Alt", ctrl: false, shift: false, alt: true, meta: false };
    run = runKey(run, alt, 100).run; // physical Alt keydown before "="
    ({ run } = playOne(run, 200));
    const r = run.results[run.results.length - 1]!;
    expect(r).toMatchObject({ taskId: "autosum-column", status: "done" });
    expect(r.keystrokes).toBe(r.optimal);
  });
});
