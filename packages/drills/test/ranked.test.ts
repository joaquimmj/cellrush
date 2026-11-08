import { describe, expect, it } from "vitest";
import { SHORTCUTS, bindingFor } from "@cellrush/engine";
import { TASKS, createRun, dailyConfig, isRankable, scenarioById, taskPool, unverifiedShortcuts, validateRun, type RunConfig } from "../src";

const base: Omit<RunConfig, "mode"> = { seed: 7, platform: "win", layout: "us", today: "2026-11-20" };
const NOW = Date.UTC(2026, 10, 20, 12);

describe("ranked runs only use shortcuts on Microsoft's official page", () => {
  for (const platform of ["win", "mac"] as const) {
    it(`timed and task-count pools on ${platform} hold only verified shortcuts`, () => {
      for (const mode of [{ kind: "time", seconds: 60 }, { kind: "tasks", count: 25 }] as const) {
        const pool = taskPool({ ...base, platform, mode });
        expect(pool.length).toBeGreaterThan(20);
        for (const t of pool) {
          for (const id of t.requires) {
            const s = SHORTCUTS.find((x) => x.id === id)!;
            if (bindingFor(s, platform)) expect(s.verified[platform], `${t.id} uses ${id}`).toBe(true);
          }
        }
      }
    });
    it(`the Daily on ${platform} draws only rankable drills`, () => {
      const pool = taskPool(dailyConfig("2026-11-20", platform, "us"));
      expect(pool.every((t) => isRankable(t, platform))).toBe(true);
    });
  }

  it("unverified drills stay in Learn mode", () => {
    const learn = taskPool({ ...base, mode: { kind: "learn" } }).map((t) => t.id);
    const timed = taskPool({ ...base, mode: { kind: "time", seconds: 60 } }).map((t) => t.id);
    for (const id of ["autofit-column", "add-decimal", "remove-decimal", "extend-row-start"]) {
      expect(learn).toContain(id);
      expect(timed).not.toContain(id);
    }
  });

  it("names the missing shortcuts", () => {
    expect(unverifiedShortcuts(TASKS.find((t) => t.id === "autofit-column")!, "win")).toEqual(["autofit-column"]);
    expect(unverifiedShortcuts(scenarioById("pnl-banking")!, "win")).toEqual(["font-color"]);
    expect(isRankable(scenarioById("pnl-banking")!, "mac")).toBe(true);
    expect(isRankable(scenarioById("revenue-projection")!, "win")).toBe(true);
  });

  it("the server refuses a practice-only scenario", () => {
    const run = createRun({ ...base, mode: { kind: "scenario", id: "clean-data" } });
    const v = validateRun({ v: 1, seed: 7, mode: run.config.mode, platform: "win", layout: "us", today: "2026-11-20", daily: false, events: [{ t: 0, code: "ArrowDown", key: "ArrowDown", mods: 0 }] }, NOW);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/practice only/);
  });
});
