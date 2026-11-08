import { describe, expect, it } from "vitest";
import { COLOR_KEYS, THEMES, contrast } from "./index";

describe("themes", () => {
  it("ship the 8 themes of the brief, with unique ids", () => {
    expect(THEMES).toHaveLength(8);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(8);
  });
  for (const t of THEMES) {
    describe(t.id, () => {
      it("defines every colour as #rrggbb", () => {
        for (const k of COLOR_KEYS) expect(t.colors[k], k).toMatch(/^#[0-9a-f]{6}$/i);
      });
      // WCAG AA: 4.5:1 for normal text. Panels hold text too.
      it.each(["bg", "panel"] as const)("text and secondary text are readable on %s (AA)", (surface) => {
        expect(contrast(t.colors.text, t.colors[surface])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.colors.sub, t.colors[surface])).toBeGreaterThanOrEqual(4.5);
      });
      it("accent, warning and error colours are readable on the background (AA)", () => {
        for (const k of ["accent", "warn", "bad"] as const) expect(contrast(t.colors[k], t.colors.bg), k).toBeGreaterThanOrEqual(4.5);
      });
    });
  }
});
