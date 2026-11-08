import { describe, expect, it } from "vitest";
import { FR_PROMPTS, FR_SCENARIOS, SCENARIOS, TASKS, conditionLabel, mulberry32, promptText, scenarioText } from "../src";

const CTX = { today: "2026-11-08", platform: "win" as const };

describe("French prompts", () => {
  it("every drill has one", () => {
    const missing = TASKS.map((t) => t.id).filter((id) => !FR_PROMPTS[id]);
    expect(missing).toEqual([]);
  });
  it("no stale entries for drills that no longer exist", () => {
    const ids = new Set(TASKS.map((t) => t.id));
    expect(Object.keys(FR_PROMPTS).filter((id) => !ids.has(id))).toEqual([]);
  });
  it.each(TASKS.map((t) => [t.id, t] as const))("%s renders cleanly in French for several seeds", (_id, t) => {
    for (const seed of [1, 2, 3, 42]) {
      const { params } = t.setup(mulberry32(seed), CTX);
      const fr = promptText(t, params, "fr");
      expect(fr).not.toMatch(/undefined|NaN|\[object/);
      expect(fr).not.toBe(t.prompt(params));
      // Cell references in the English prompt appear in the French one too.
      for (const ref of t.prompt(params).match(/\b[A-Z]{1,2}\d{1,2}(:[A-Z]{1,2}\d{1,2})?\b/g) ?? []) expect(fr, ref).toContain(ref);
    }
  });
  it("English stays the default", () => {
    const t = TASKS[0]!;
    const { params } = t.setup(mulberry32(1), CTX);
    expect(promptText(t, params, "en")).toBe(t.prompt(params));
  });
});

describe("French scenarios", () => {
  it.each(SCENARIOS.map((s) => [s.id, s] as const))("%s: title, blurb and every condition are translated", (_id, s) => {
    expect(FR_SCENARIOS[s.id]).toBeDefined();
    expect(scenarioText(s, "fr").title).not.toBe(s.title);
    for (const c of s.conditions) expect(conditionLabel(s.id, c.id, c.label, "fr"), c.id).not.toBe(c.label);
    const { params } = s.setup(mulberry32(1), CTX);
    expect(promptText(s, params, "fr")).not.toMatch(/undefined|NaN/);
  });
});
