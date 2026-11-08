import { describe, expect, it } from "vitest";
import { dispatchKey, type GridState, type Platform } from "@cellrush/engine";
import {
  SCENARIOS, checklist, cleanScenario, createRun, mulberry32, pnlScenario, projectionScenario, runKey, strokeToRaws, tick,
  toSubmission, validateRun, type Scenario,
} from "../src";

const CTX = { today: "2026-11-08" };
const SEEDS = [1, 2, 3, 7, 42, 99];

function setup(s: Scenario, seed: number, platform: Platform) {
  return s.setup(mulberry32(seed), { ...CTX, platform });
}
function play(st: GridState, strokes: string[], platform: Platform = "win"): GridState {
  for (const raw of strokes.flatMap((x) => strokeToRaws(x, "us"))) st = dispatchKey(st, raw, { platform, layout: "us" }).state;
  return st;
}
const passed = (s: Scenario, st: GridState, p: unknown) =>
  Object.fromEntries(checklist(s, st, p as { platform: Platform }).map((c) => [c.id, c.pass]));

describe("scenario catalogue", () => {
  it("has the three Analyst-mode scenarios", () => expect(SCENARIOS.map((s) => s.id)).toEqual(["pnl-banking", "revenue-projection", "clean-data"]));
  it("Windows-only conditions are left out of the Mac checklist", () => {
    const p = setup(pnlScenario, 1, "mac").params;
    const ids = checklist(pnlScenario, setup(pnlScenario, 1, "mac").state, p).map((c) => c.id);
    expect(ids).not.toContain("inputs-blue");
    expect(ids).not.toContain("formulas-black");
    expect(ids).toContain("negatives-parens");
    const c = setup(cleanScenario, 1, "mac");
    expect(checklist(cleanScenario, c.state, c.params).map((x) => x.id)).not.toContain("client-autofit");
  });
});

for (const s of SCENARIOS) {
  describe(`scenario ${s.id}`, () => {
    for (const platform of ["win", "mac"] as const) {
      it(`${platform}: every condition fails at the start`, () => {
        for (const seed of SEEDS) {
          const { state, params } = setup(s, seed, platform);
          for (const c of checklist(s, state, params)) expect(c.pass, `${c.id} seed ${seed}`).toBe(false);
        }
      });
      it(`${platform}: the optimal path ticks every box, exactly on its last key`, () => {
        for (const seed of SEEDS) {
          const { state, params } = setup(s, seed, platform);
          const raws = s.optimal(params)[platform]!.flatMap((x) => strokeToRaws(x, "us"));
          let st = state;
          raws.forEach((raw, i) => {
            st = dispatchKey(st, raw, { platform, layout: "us" }).state;
            expect(s.check(st, params), `seed ${seed} key ${i + 1}/${raws.length} ${raw.code}`).toBe(i === raws.length - 1);
          });
          expect(checklist(s, st, params).every((c) => c.pass)).toBe(true);
        }
      });
    }
  });
}

describe("checklists judge each condition on its own", () => {
  it("P&L: only the % format done → only that box", () => {
    const { state, params } = setup(pnlScenario, 3, "win");
    const st = play(state, [...Array(6).fill("ArrowDown"), "shift+ArrowDown", "ctrl+shift+ArrowRight", "ctrl+shift+Digit5"]);
    expect(passed(pnlScenario, st, params)).toEqual({
      "inputs-blue": false, "formulas-black": false, "margins-percent": true, "totals-bold-border": false, "negatives-parens": false,
    });
  });
  it("P&L: bold without the border is not enough", () => {
    const { state, params } = setup(pnlScenario, 3, "win");
    const st = play(state, ["ArrowDown", "ArrowDown", "ctrl+shift+ArrowRight", "ctrl+b", "ArrowDown", "ArrowDown", "ctrl+shift+ArrowRight", "ctrl+b"]);
    expect(passed(pnlScenario, st, params)["totals-bold-border"]).toBe(false);
  });
  it("P&L: a red font on inputs is not blue", () => {
    const { state, params } = setup(pnlScenario, 3, "win");
    const st = play(state, ["shift+ArrowDown", "ctrl+shift+ArrowRight", "AltLeft", "h", "f", "c", "ArrowRight", "ArrowRight", "Enter"]);
    expect(passed(pnlScenario, st, params)["inputs-blue"]).toBe(false);
  });
  it("Projection: filling without $ anchoring fails growth and anchoring, not totals", () => {
    const { state, params } = setup(projectionScenario, 5, "win");
    const st = play(state, [
      "shift+ArrowDown", "shift+ArrowRight", "shift+ArrowRight", "shift+ArrowRight", "type:=B4*(1+B1)", "ctrl+Enter",
      "ArrowDown", "ArrowDown", "ArrowLeft", "shift+ArrowRight", "shift+ArrowRight", "shift+ArrowRight", "shift+ArrowRight", "alt+Equal", "ctrl+Enter",
    ]);
    expect(passed(projectionScenario, st, params)).toEqual({ "growth-formulas": false, "rate-anchored": false, totals: true });
  });
  it("Projection: typing the right numbers instead of formulas does not count", () => {
    const { state, params } = setup(projectionScenario, 5, "win");
    const v = Math.round(Number((state.sheets[0]!.cells["3:1"]!.value as number) * (1 + params.rate)));
    const st = play(state, [`type:${v}`, "Enter"]);
    expect(passed(projectionScenario, st, params)["growth-formulas"]).toBe(false);
  });
  it("Clean: deleting a data row along with the blanks fails 'nothing lost'", () => {
    const { state, params } = setup(cleanScenario, 2, "win");
    const [b1, b2] = params.blanks;
    const st = play(state, [
      ...Array(b1).fill("ArrowDown"), "shift+Space", "ctrl+Minus",
      ...Array(b2 - 1 - b1).fill("ArrowDown"), "shift+Space", "ctrl+Minus",
      "shift+Space", "ctrl+Minus", // one too many: a real row
    ]);
    expect(passed(cleanScenario, st, params)["no-blank-rows"]).toBe(false);
  });
  it("Clean: values pasted but blanks left → only the VAT box", () => {
    const { state, params } = setup(cleanScenario, 2, "win");
    // Select the whole VAT column area (including blanks) and paste values over itself.
    const st = play(state, ["ArrowDown", "ArrowRight", "ArrowRight", "ArrowRight", ...Array(params.n + 1).fill("shift+ArrowDown"), "ctrl+c", "ctrl+alt+v", "v", "Enter"]);
    expect(passed(cleanScenario, st, params)).toEqual({ "no-blank-rows": false, "client-autofit": false, "vat-values": true });
  });
});

describe("scenario runs", () => {
  const cfg = (id: string, platform: Platform = "win") => ({
    seed: 4, mode: { kind: "scenario" as const, id }, platform, layout: "us" as const, today: CTX.today,
  });
  function solve(id: string, platform: Platform, gap = 220) {
    let run = createRun(cfg(id, platform));
    const cur = run.current!;
    let t = 0;
    for (const raw of cur.task.optimal(cur.params)[platform]!.flatMap((x) => strokeToRaws(x, "us"))) run = runKey(run, raw, (t += gap)).run;
    return run;
  }
  it.each(SCENARIOS.map((s) => s.id))("%s: a solved run finishes with one completed result", (id) => {
    const run = solve(id, "win");
    expect(run.finishedAt).not.toBeNull();
    expect(run.results).toEqual([expect.objectContaining({ taskId: id, status: "done" })]);
  });
  it("the time limit ends an unsolved scenario, keeping the board for the checklist", () => {
    let run = createRun(cfg("revenue-projection"));
    run = runKey(run, strokeToRaws("shift+ArrowDown", "us")[0]!, 0).run;
    run = tick(run, 181_000);
    expect(run.finishedAt).toBe(180_000);
    expect(run.results).toHaveLength(0);
    const items = checklist(projectionScenario, run.current!.state, run.current!.params as never);
    expect(items.every((c) => !c.pass)).toBe(true);
  });
  it("the server accepts a scenario run and agrees it is complete", () => {
    const run = solve("clean-data", "mac");
    const v = validateRun(toSubmission(run, false), Date.UTC(2026, 10, 8, 12));
    expect(v.ok).toBe(true);
    expect(v.score!.completed).toBe(1);
    expect(v.summary!.mode).toBe("sc-clean-data");
  });
  it("learn runs can never be submitted", () => {
    const run = solve("clean-data", "win");
    const v = validateRun({ ...toSubmission(run, false), mode: { kind: "learn" } }, Date.UTC(2026, 10, 8, 12));
    expect(v).toMatchObject({ ok: false, reason: "bad mode" });
  });
});
