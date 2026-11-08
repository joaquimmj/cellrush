import { describe, expect, it } from "vitest";
import { SHORTCUTS, dispatchKey, type LayoutId, type Platform } from "@cellrush/engine";
import { TASKS, isReady, mulberry32, strokeToRaws, type Task } from "../src";

const CTX = { today: "2026-11-08" };
const SEEDS = [1, 2, 3, 7, 42, 1234];
const PLATFORMS: Platform[] = ["win", "mac"];
const LAYOUTS: LayoutId[] = ["us", "uk", "fr-azerty", "de-qwertz"];
// On QWERTZ, ';' and "'" need Shift, which the Ctrl+; / Ctrl+' chords don't allow (documented gap).
const QWERTZ_GAPS = new Set(["insert-today", "copy-formula-above"]);

const done = (t: Task, st: Parameters<Task["check"]>[0], p: unknown) => (t.allowEditing || isReady(st)) && t.check(st, p);

describe("drill catalogue", () => {
  it("has at least 60 drills", () => expect(TASKS.length).toBeGreaterThanOrEqual(60));
  it("ids are unique and kebab-case", () => {
    const ids = TASKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  it("covers every category", () => {
    const cats = new Set(TASKS.map((t) => t.category));
    for (const c of ["navigation", "selection", "editing", "formatting", "rows-cols", "clipboard", "formulas", "sheets", "ribbon"]) expect(cats).toContain(c);
  });
  it("`requires` only names real shortcuts", () => {
    const ids = new Set(SHORTCUTS.map((s) => s.id));
    for (const t of TASKS) for (const r of t.requires) expect(ids.has(r), `${t.id} requires ${r}`).toBe(true);
  });
  it("every drill has a Windows path; Mac paths exist except ribbon keytips", () => {
    for (const t of TASKS) {
      const inst = t.setup(mulberry32(1), CTX);
      const path = t.optimal(inst.params);
      expect(path.win, t.id).not.toBeNull();
      if (t.category !== "ribbon") expect(path.mac, t.id).not.toBeNull();
    }
  });
  it("setup is deterministic for a seed", () => {
    for (const t of TASKS) {
      const a = t.setup(mulberry32(99), CTX);
      const b = t.setup(mulberry32(99), CTX);
      expect(JSON.stringify(a.params), t.id).toBe(JSON.stringify(b.params));
      expect(JSON.stringify(a.state.sheets), t.id).toBe(JSON.stringify(b.state.sheets));
    }
  });
  it("prompts render with real cell names", () => {
    for (const t of TASKS) {
      const text = t.prompt(t.setup(mulberry32(5), CTX).params);
      expect(text, t.id).not.toMatch(/undefined|NaN|\[object/);
      expect(text.length, t.id).toBeGreaterThan(8);
    }
  });
});

// The bot: play each drill's optimal path and check it lands exactly on the last stroke.
for (const task of TASKS) {
  describe(`drill ${task.id}`, () => {
    for (const platform of PLATFORMS) {
      for (const layout of LAYOUTS) {
        if (layout === "de-qwertz" && QWERTZ_GAPS.has(task.id)) continue;
        it(`${platform} / ${layout}: optimal path solves it, not before the last key`, () => {
          for (const seed of SEEDS) {
            const inst = task.setup(mulberry32(seed), CTX);
            const path = task.optimal(inst.params)[platform];
            if (!path) return; // not on this platform
            expect(done(task, inst.state, inst.params), `${task.id} seed ${seed} solved at setup`).toBe(false);
            const raws = path.flatMap((s) => strokeToRaws(s, layout));
            let st = inst.state;
            raws.forEach((raw, i) => {
              st = dispatchKey(st, raw, { platform, layout }).state;
              const isLast = i === raws.length - 1;
              expect(done(task, st, inst.params), `${task.id} seed ${seed} after key ${i + 1}/${raws.length} (${raw.code})`).toBe(isLast);
            });
          }
        });
      }
    }
  });
}
