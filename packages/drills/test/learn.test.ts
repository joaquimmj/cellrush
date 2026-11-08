import { describe, expect, it } from "vitest";
import {
  MAX_BOX, TASKS, createRun, describePath, learnPicker, learnWeight, masteredCount, mulberry32, recordOutcome, runKey,
  strokeToRaws, taskById, toReview, type LearnBoxes,
} from "../src";

describe("describePath (hints)", () => {
  it("Windows chords, keytips, typed text, repeats", () => {
    expect(describePath(["ctrl+shift+ArrowDown", "ctrl+shift+Digit5"], "win", "us")).toEqual(["Ctrl+Shift+↓", "Ctrl+Shift+%"]);
    expect(describePath(["AltLeft", "h", "0"], "win", "us")).toEqual(["Alt", "H", "0"]);
    expect(describePath(["type:=SUM(", "ArrowUp", "ArrowUp", "ArrowUp", "Enter"], "win", "us")).toEqual(["type “=SUM(”", "↑ ×3", "Enter"]);
  });
  it("Mac symbols", () => expect(describePath(["meta+shift+ArrowRight", "meta+b"], "mac", "us")).toEqual(["⇧⌘→", "⌘B"]));
  it("layout-aware labels (AZERTY shows the key's own symbol)", () =>
    expect(describePath(["ctrl+shift+Digit5"], "win", "fr-azerty")).toEqual(["Ctrl+Shift+5"]));
  it("every drill's path can be described on its platforms", () => {
    for (const t of TASKS) {
      const p = t.setup(mulberry32(1), { today: "2026-11-08" }).params;
      for (const plat of ["win", "mac"] as const) {
        const path = t.optimal(p)[plat];
        if (path) expect(describePath(path, plat, "us").join(" ")).not.toMatch(/undefined|NaN/);
      }
    }
  });
});

describe("Leitner boxes", () => {
  const ok = { hinted: false, skipped: false, keystrokes: 2, optimal: 2 };
  it("a clean solve moves up a box, capped", () => {
    let b: LearnBoxes = {};
    for (let i = 0; i < 7; i++) b = recordOutcome(b, "bold-cell", ok);
    expect(b["bold-cell"]).toEqual({ box: MAX_BOX, seen: 7, missed: 0 });
  });
  it.each([
    ["needing the hint", { ...ok, hinted: true }],
    ["skipping", { ...ok, skipped: true }],
    ["extra keys", { ...ok, keystrokes: 5 }],
  ])("%s sends it back to box 0", (_n, o) => {
    let b: LearnBoxes = { "bold-cell": { box: 3, seen: 3, missed: 0 } };
    b = recordOutcome(b, "bold-cell", o);
    expect(b["bold-cell"]).toMatchObject({ box: 0, missed: 1 });
    expect(toReview(b)).toEqual(["bold-cell"]);
  });
  it("weights: missed > unseen > mastered", () => {
    expect(learnWeight({ box: 0, seen: 1, missed: 1 })).toBeGreaterThan(learnWeight(undefined));
    expect(learnWeight(undefined)).toBeGreaterThan(learnWeight({ box: MAX_BOX, seen: 5, missed: 0 }));
  });
  it("mastered count", () => expect(masteredCount({ a: { box: 4, seen: 4, missed: 0 }, b: { box: 3, seen: 3, missed: 0 }, c: { box: 1, seen: 1, missed: 0 } })).toBe(2));
});

describe("learn picker", () => {
  it("brings missed drills back far more often than mastered ones", () => {
    const pool = [taskById("bold-cell")!, taskById("go-home")!, taskById("select-row")!];
    const boxes: LearnBoxes = { "bold-cell": { box: 0, seen: 3, missed: 3 }, "go-home": { box: 4, seen: 9, missed: 0 }, "select-row": { box: 4, seen: 9, missed: 0 } };
    const pick = learnPicker(() => boxes);
    const rng = mulberry32(5);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) {
      const t = pick(rng, pool, null);
      counts[t.id] = (counts[t.id] ?? 0) + 1;
    }
    expect(counts["bold-cell"]!).toBeGreaterThan(5 * counts["go-home"]!);
  });
  it("never repeats the previous drill", () => {
    const pick = learnPicker(() => ({}));
    const rng = mulberry32(9);
    let prev = TASKS[0]!;
    for (let i = 0; i < 200; i++) {
      const t = pick(rng, TASKS, prev);
      expect(t.id).not.toBe(prev.id);
      prev = t;
    }
  });
  it("a learn run is endless and uses the picker", () => {
    const boxes: LearnBoxes = { "bold-cell": { box: 0, seen: 5, missed: 5 } };
    // Formatting drills only (9): bold-cell weighs 16 against 6 for each unseen one → ~20% of picks vs ~11% uniform.
    let run = createRun({
      seed: 3, mode: { kind: "learn" }, platform: "win", layout: "us", today: "2026-11-08",
      categories: ["formatting"], pick: learnPicker(() => boxes),
    });
    let t = 0;
    for (let i = 0; i < 300; i++) {
      const cur = run.current!;
      for (const raw of cur.task.optimal(cur.params).win!.flatMap((s) => strokeToRaws(s, "us"))) run = runKey(run, raw, (t += 300)).run;
    }
    expect(run.finishedAt).toBeNull();
    expect(run.results).toHaveLength(300);
    const uniform = 300 / run.pool.length;
    expect(run.results.filter((r) => r.taskId === "bold-cell").length).toBeGreaterThan(1.4 * uniform);
  });
});
