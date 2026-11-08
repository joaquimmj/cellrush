import { describe, expect, it } from "vitest";
import { currentRegion, lastUsed, parseA1, rangeToA1 } from "../src";
import { at, grid, keys, sel } from "./helpers";

// A 4×3 block at B2:D5, a lone value at F2, and a value at B9.
const DATA = [
  [null, null, null, null, null, null],
  [null, "Name", "Q1", "Q2", null, "x"],
  [null, "A", 1, 2],
  [null, "B", 3, 4],
  [null, "C", 5, 6],
  [], [], [],
  [null, "foot"],
];

describe("arrows", () => {
  it("move one cell", () => expect(at(keys(grid(DATA, "C3"), "ArrowDown, ArrowRight"))).toBe("D4"));
  it("stop at the top-left edge", () => expect(at(keys(grid(DATA, "A1"), "ArrowUp, ArrowLeft"))).toBe("A1"));
  it("stop at the bottom-right edge", () => expect(at(keys(grid(DATA, "Z60"), "ArrowDown, ArrowRight"))).toBe("Z60"));
});

describe("Ctrl+Arrow (edge of data)", () => {
  it("inside a block → last filled cell", () => expect(at(keys(grid(DATA, "B2"), "ctrl+ArrowDown"))).toBe("B5"));
  it("at block end → next filled cell", () => expect(at(keys(grid(DATA, "B5"), "ctrl+ArrowDown"))).toBe("B9"));
  it("from empty → next filled cell", () => expect(at(keys(grid(DATA, "B1"), "ctrl+ArrowDown"))).toBe("B2"));
  it("nothing further → sheet edge", () => expect(at(keys(grid(DATA, "B9"), "ctrl+ArrowDown"))).toBe("B60"));
  it("right across a gap", () => expect(at(keys(grid(DATA, "D2"), "ctrl+ArrowRight"))).toBe("F2"));
  it("left back into the block", () => expect(at(keys(grid(DATA, "F2"), "ctrl+ArrowLeft"))).toBe("D2"));
  it("up to the top", () => expect(at(keys(grid(DATA, "C5"), "ctrl+ArrowUp"))).toBe("C2"));
  it("already at sheet edge does nothing", () => expect(at(keys(grid(DATA, "A1"), "ctrl+ArrowUp"))).toBe("A1"));
  it("mac uses Cmd", () => expect(at(keys(grid(DATA, "B2"), "meta+ArrowDown", { platform: "mac" }))).toBe("B5"));
  it("Ctrl on mac does not jump", () => expect(at(keys(grid(DATA, "B2"), "ctrl+ArrowDown", { platform: "mac" }))).toBe("B2"));
});

describe("Home / Ctrl+Home / Ctrl+End / PgDn", () => {
  it("Home → column A", () => expect(at(keys(grid(DATA, "D4"), "Home"))).toBe("A4"));
  it("Ctrl+Home → A1", () => expect(at(keys(grid(DATA, "D4"), "ctrl+Home"))).toBe("A1"));
  it("Ctrl+End → last used row × col", () => expect(at(keys(grid(DATA, "A1"), "ctrl+End"))).toBe("F9"));
  it("PgDn moves a page", () => expect(at(keys(grid(DATA, "A1"), "PageDown"))).toBe("A21"));
  it("PgUp clamps at top", () => expect(at(keys(grid(DATA, "A5"), "PageUp"))).toBe("A1"));
});

describe("selection", () => {
  it("Shift+Arrow extends and keeps the active cell", () => {
    const st = keys(grid(DATA, "B2"), "shift+ArrowDown, shift+ArrowRight");
    expect(sel(st)).toBe("B2:C3");
    expect(at(st)).toBe("B2");
  });
  it("Ctrl+Shift+Arrow extends to the block edge", () => expect(sel(keys(grid(DATA, "B2"), "ctrl+shift+ArrowDown, ctrl+shift+ArrowRight"))).toBe("B2:D5"));
  it("mac Cmd+Shift+Arrow", () => expect(sel(keys(grid(DATA, "B2"), "meta+shift+ArrowDown", { platform: "mac" }))).toBe("B2:B5"));
  it("Shift+Space selects the row", () => expect(sel(keys(grid(DATA, "C3"), "shift+Space"))).toBe("A3:Z3"));
  it("Shift+Space keeps multi-row extent", () => expect(sel(keys(grid(DATA, "C3"), "shift+ArrowDown, shift+Space"))).toBe("A3:Z4"));
  it("Ctrl+Space selects the column", () => expect(sel(keys(grid(DATA, "C3"), "ctrl+Space"))).toBe("C1:C60"));
  it("Ctrl+A selects the current region", () => expect(sel(keys(grid(DATA, "C3"), "ctrl+a"))).toBe("B2:D5"));
  it("Ctrl+A twice selects the sheet", () => expect(sel(keys(grid(DATA, "C3"), "ctrl+a, ctrl+a"))).toBe("A1:Z60"));
  it("Ctrl+A on an isolated empty cell selects the sheet", () => expect(sel(keys(grid(DATA, "M30"), "ctrl+a"))).toBe("A1:Z60"));
  it("Ctrl+Shift+Space = Ctrl+A", () => expect(sel(keys(grid(DATA, "C3"), "ctrl+shift+Space"))).toBe("B2:D5"));
  it("Ctrl+Shift+End", () => expect(sel(keys(grid(DATA, "B2"), "ctrl+shift+End"))).toBe("B2:F9"));
  it("Shift+Home", () => expect(sel(keys(grid(DATA, "D4"), "shift+Home"))).toBe("A4:D4"));
  it("plain arrow collapses the selection", () => expect(sel(keys(grid(DATA, "B2"), "shift+ArrowDown, ArrowRight"))).toBe("C2"));
});

describe("region helpers", () => {
  it("currentRegion includes diagonal neighbours", () => {
    const st = grid([["a", null], [null, "b"]]);
    expect(rangeToA1(currentRegion(st.sheets[0]!, parseA1("A1")))).toBe("A1:B2");
  });
  it("lastUsed on an empty sheet is A1", () => expect(lastUsed(grid([]).sheets[0]!)).toEqual({ r: 0, c: 0 }));
});

describe("hidden rows/cols are skipped", () => {
  it("arrow skips hidden row", () => {
    const st = grid([["a"], ["b"], ["c"]]);
    const hidden = { ...st, sheets: [{ ...st.sheets[0]!, hiddenRows: [1] }] };
    expect(at(keys(hidden, "ArrowDown"))).toBe("A3");
  });
  it("arrow skips hidden column", () => {
    const st = grid([["a", "b", "c"]]);
    const hidden = { ...st, sheets: [{ ...st.sheets[0]!, hiddenCols: [1] }] };
    expect(at(keys(hidden, "ArrowRight"))).toBe("C1");
  });
});
