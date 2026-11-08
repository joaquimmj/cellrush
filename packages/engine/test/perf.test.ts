import { describe, expect, it } from "vitest";
import { createSheet, createState, dispatchKey, fillFromRows, rawFromChord, type GridState, type KeyChord } from "../src";

/** A busy sheet: 40 rows × 10 columns of numbers plus a formula column and totals. */
function busy(): GridState {
  const rows: (string | number)[][] = [];
  for (let r = 0; r < 40; r++) rows.push([...Array.from({ length: 10 }, (_, c) => r * 10 + c), `=SUM(A${r + 1}:J${r + 1})`, `=K${r + 1}*1.2`]);
  rows.push([...Array.from({ length: 12 }, (_, c) => `=SUM(${String.fromCharCode(65 + c)}1:${String.fromCharCode(65 + c)}40)`)]);
  return createState({ sheets: [fillFromRows(createSheet(), rows)] });
}

function p95(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.95)]!;
}

// Budgets stay inside one 16 ms frame with headroom for slow CI machines and parallel test runs.
// (Measured locally: p95 ≈ 0.2 ms navigation, ≈ 1 ms recalculating edit.)
describe("keystroke cost in the engine (budget: well under one 16 ms frame)", () => {
  const ctx = { platform: "win" as const, layout: "us" as const };
  const key = (c: KeyChord) => rawFromChord(c, "us");
  const time = (st: GridState, chords: KeyChord[]) => {
    // Warm-up so the JIT has compiled the hot paths before we measure.
    for (let i = 0; i < 30; i++) for (const c of chords) st = dispatchKey(st, key(c), ctx).state;
    const out: number[] = [];
    for (let i = 0; i < 200; i++) {
      for (const c of chords) {
        const t = performance.now();
        st = dispatchKey(st, key(c), ctx).state;
        out.push(performance.now() - t);
      }
    }
    return out;
  };
  it("navigation", () => expect(p95(time(busy(), [{ code: "ArrowDown" }, { ctrl: true, code: "ArrowRight" }, { ctrl: true, code: "Home" }]))).toBeLessThan(4));
  it("an edit that recalculates 92 formulas", () =>
    expect(p95(time(busy(), [{ code: "Digit7" }, { code: "Enter" }, { code: "ArrowUp" }]))).toBeLessThan(8));
  it("fill down over a column", () => expect(p95(time(busy(), [{ ctrl: true, shift: true, code: "ArrowDown" }, { ctrl: true, char: "d" }, { ctrl: true, char: "z" }]))).toBeLessThan(12));
});
