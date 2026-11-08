import { describe, expect, it } from "vitest";
import {
  createRun, dailyConfig, mulberry32, runKey, scoreRun, strokeToRaws, tick, toSubmission, validateRun,
  type RunConfig, type RunState, type RunSubmission,
} from "../src";

const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);
const TODAY = "2026-11-20";

/**
 * A "human" player: optimal paths with jittery gaps (median ~180 ms), starting at t = 0.
 * Returns the finished run.
 */
function playHuman(config: RunConfig, seed = 1, base = 180, readMs = 900): RunState {
  const rng = mulberry32(seed);
  let run = createRun(config);
  let t = 0;
  let first = true;
  for (let guard = 0; guard < 2000 && run.finishedAt === null; guard++) {
    const cur = run.current!;
    // Reading the prompt takes a moment (0.6–1.2 s by default) before the first key of a drill.
    if (!first && readMs > 0) t += readMs * 2 / 3 + rng.int(0, readMs * 2 / 3);
    for (const raw of cur.task.optimal(cur.params)[config.platform]!.flatMap((s) => strokeToRaws(s, config.layout))) {
      if (!first) t += base / 2 + rng.int(0, base);
      first = false;
      run = runKey(run, raw, t).run;
      if (run.finishedAt !== null) break;
    }
    if (config.mode.kind === "time" && t > config.mode.seconds * 1000) run = tick(run, t);
  }
  return run;
}

const timed: RunConfig = { seed: 99, mode: { kind: "time", seconds: 30 }, platform: "win", layout: "us", today: TODAY };

describe("validateRun: honest runs", () => {
  it("a timed run replays to exactly the client's score and is ranked", () => {
    const run = playHuman(timed);
    const v = validateRun(toSubmission(run, false), NOW);
    expect(v.ok).toBe(true);
    expect(v.flags).toEqual([]);
    expect(v.ranked).toBe(true);
    expect(v.score!.score).toBe(scoreRun(run).score);
    expect(v.score!.completed).toBe(scoreRun(run).completed);
  });
  it("today's daily is accepted with its number", () => {
    const run = playHuman(dailyConfig(TODAY, "mac", "fr-azerty"), 3);
    const v = validateRun(toSubmission(run, true), NOW);
    expect(v).toMatchObject({ ok: true, ranked: true, dailyNumber: 13 });
    expect(v.score!.completed).toBe(10);
  });
  it("a daily played at 23:59 can still be submitted just after midnight", () => {
    const run = playHuman(dailyConfig(TODAY, "win", "us"), 4);
    expect(validateRun(toSubmission(run, true), Date.UTC(2026, 10, 21, 0, 5)).ok).toBe(true);
  });
});

describe("validateRun: the client cannot set its score", () => {
  it("there is no score field to tamper with; extra fields are ignored", () => {
    const run = playHuman(timed);
    const sub = { ...toSubmission(run, false), score: 999_999, efficiency: 1 } as RunSubmission;
    expect(validateRun(sub, NOW).score!.score).toBe(scoreRun(run).score);
  });
  it("dropping keystrokes to look efficient → drills stay unsolved, score drops", () => {
    const run = playHuman(timed);
    const sub = toSubmission(run, false);
    const kept = sub.events.filter((_, i) => i % 5 !== 3);
    const v = validateRun({ ...sub, events: kept }, NOW);
    expect(v.ok).toBe(true);
    expect(v.score!.completed).toBeLessThan(scoreRun(run).completed);
    expect(v.score!.score).toBeLessThan(scoreRun(run).score);
  });
  it("compressing the timeline to fit more drills → flagged, not ranked", () => {
    const run = playHuman({ ...timed, mode: { kind: "time", seconds: 60 } }, 5);
    const sub = toSubmission(run, false);
    const fast = sub.events.map((e) => ({ ...e, t: Math.round(e.t / 10) }));
    const v = validateRun({ ...sub, events: fast }, NOW);
    expect(v.ok).toBe(true);
    expect(v.flags).toContain("inhuman-speed");
    expect(v.ranked).toBe(false);
  });
  it("perfectly regular key timing (a script) → flagged", () => {
    const run = playHuman(timed);
    const sub = toSubmission(run, false);
    const v = validateRun({ ...sub, events: sub.events.map((e, i) => ({ ...e, t: i * 120 })) }, NOW);
    expect(v.flags).toContain("robotic-timing");
    expect(v.ranked).toBe(false);
  });
  it("a bot at 300 tasks/min → flagged", () => {
    const run = playHuman(timed, 7, 40, 0); // no reading time, 20–60 ms per key
    const v = validateRun(toSubmission(run, false), NOW);
    expect(v.flags).toEqual(expect.arrayContaining(["impossible-tpm"]));
    expect(v.ranked).toBe(false);
  });
});

describe("validateRun: refused submissions", () => {
  const good = () => toSubmission(playHuman(timed), false);
  it.each<[string, (s: RunSubmission) => RunSubmission]>([
    ["malformed submission", () => ({}) as RunSubmission],
    ["bad mode", (s) => ({ ...s, mode: { kind: "time", seconds: 45 } as never })],
    ["bad platform", (s) => ({ ...s, platform: "linux" as never })],
    ["bad layout", (s) => ({ ...s, layout: "dvorak" as never })],
    ["events out of order", (s) => ({ ...s, events: [...s.events].reverse() })],
    ["events must start at t=0", (s) => ({ ...s, events: s.events.map((e) => ({ ...e, t: e.t + 5 })) })],
    ["bad event", (s) => ({ ...s, events: s.events.map((e, i) => (i === 3 ? { ...e, mods: 99 } : e)) })],
    ["date in the future", (s) => ({ ...s, today: "2027-01-01" })],
    ["events after the end of the run", (s) => ({ ...s, events: [...s.events, { ...s.events[0]!, t: 99_000 }] })],
  ])("%s", (reason, mutate) => {
    const v = validateRun(mutate(good()), NOW);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe(reason);
  });
  it("a task run cut short is refused (run not finished)", () => {
    const sub = toSubmission(playHuman({ ...timed, mode: { kind: "tasks", count: 10 } }), false);
    expect(validateRun({ ...sub, events: sub.events.slice(0, 5) }, NOW).reason).toBe("run not finished");
  });
  it("a daily with another day's seed is refused", () => {
    const sub = toSubmission(playHuman(dailyConfig(TODAY, "win", "us")), true);
    expect(validateRun({ ...sub, seed: sub.seed + 1 }, NOW).reason).toBe("daily seed mismatch");
  });
  it("yesterday's daily is refused once the grace period is over", () => {
    const sub = toSubmission(playHuman(dailyConfig("2026-11-19", "win", "us")), true);
    expect(validateRun(sub, NOW).reason).toBe("daily is not today's");
  });
  it("a normal run cannot claim to be a daily", () => {
    const sub = toSubmission(playHuman({ ...timed, mode: { kind: "tasks", count: 10 } }), true);
    expect(validateRun(sub, NOW).reason).toBe("daily seed mismatch");
  });
});
