import { describe, expect, it } from "vitest";
import { createSheet, createState, displayText, fillFromRows, getCell, parseA1 } from "../src";
import { at, cell, grid, keys, raw, sel, type } from "./helpers";

const mac = { platform: "mac" as const };

describe("typing formulas", () => {
  it("commits and evaluates", () => {
    const st = keys(type(grid([[3, 4]], "C1"), "=A1*B1"), "Enter");
    expect(cell(st, "C1")?.value).toBe(12);
  });
  it("dependents update when an input changes", () => {
    let st = grid([[3, "=A1*2"]]);
    st = keys(type(st, "10"), "Enter");
    expect(cell(st, "B1")?.value).toBe(20);
  });
  it("undo restores computed values", () => {
    let st = grid([[3, "=A1*2"]]);
    st = keys(type(st, "10"), "Enter, ctrl+z");
    expect(cell(st, "B1")?.value).toBe(6);
  });
  it("Ctrl+Enter shifts the formula per cell", () => {
    let st = grid([[1], [2], [3]], "B1");
    st = keys(st, "shift+ArrowDown, shift+ArrowDown");
    st = keys(type(st, "=A1*10"), "ctrl+Enter");
    expect([raw(st, "B2"), cell(st, "B3")?.value]).toEqual(["=A2*10", 30]);
  });
});

describe("point mode (arrows pick cells while typing a formula)", () => {
  it("= then ArrowLeft inserts the reference", () => {
    const st = keys(type(grid([[5]], "B1"), "="), "ArrowLeft");
    expect(st.editor?.text).toBe("=A1");
    expect(st.mode).toBe("enter");
  });
  it("more arrows move the picked cell", () => {
    const st = keys(type(grid([], "C3"), "="), "ArrowUp, ArrowUp, ArrowLeft");
    expect(st.editor?.text).toBe("=B1");
  });
  it("Shift+Arrow extends to a range", () => {
    const st = keys(type(grid([], "B5"), "=SUM("), "ArrowUp, shift+ArrowUp, shift+ArrowUp");
    expect(st.editor?.text).toBe("=SUM(B2:B4");
  });
  it("after an operator, point again", () => {
    let st = keys(type(grid([[2, 3]], "C1"), "="), "ArrowLeft, ArrowLeft");
    st = keys(type(st, "*"), "ArrowLeft");
    expect(st.editor?.text).toBe("=A1*B1");
    st = keys(st, "Enter");
    expect(cell(st, "C1")?.value).toBe(6);
  });
  it("arrow after a number commits instead", () => {
    const st = keys(type(grid([]), "=1"), "ArrowDown");
    expect(st.mode).toBe("ready");
    expect(at(st)).toBe("A2");
  });
  it("F4 anchors the picked cell", () => {
    const st = keys(type(grid([], "B2"), "="), "ArrowUp, F4");
    expect(st.editor?.text).toBe("=$B$1");
  });
  it("Mac Cmd+T anchors", () => {
    const st = keys(type(grid([], "B2"), "=", mac), "ArrowUp, meta+t", mac);
    expect(st.editor?.text).toBe("=$B$1");
  });
});

describe("F4 anchoring while editing", () => {
  it("F2 then F4 toggles the ref before the caret", () => {
    const st = keys(grid([["=B1*C1"]]), "F2, F4");
    expect(st.editor?.text).toBe("=B1*$C$1");
  });
  it("F4 cycles four states then back", () => {
    const st = keys(grid([["=C1"]]), "F2, F4, F4, F4, F4");
    expect(st.editor?.text).toBe("=C1");
  });
  it("F4 in ready mode still repeats", () => {
    const st = keys(grid([["a", "b"]]), "ctrl+b, ArrowRight, F4");
    expect(cell(st, "B1")?.format.bold).toBe(true);
  });
});

describe("fill shifts formulas", () => {
  it("Ctrl+D adjusts relative refs, keeps $ refs", () => {
    let st = grid([[0.1, null], [100, "=A2*(1+$A$1)"], [200], [300]], "B2");
    st = keys(st, "shift+ArrowDown, shift+ArrowDown, ctrl+d");
    expect(raw(st, "B4")).toBe("=A4*(1+$A$1)");
    expect(cell(st, "B4")?.value).toBeCloseTo(330);
  });
  it("Ctrl+R across years", () => {
    let st = grid([[100, null, null], ["=A1*1.1"]], "A2");
    st = keys(st, "shift+ArrowRight, shift+ArrowRight, ctrl+r");
    expect(raw(st, "C2")).toBe("=C1*1.1");
  });
});

describe("clipboard", () => {
  it("copy/paste shifts formulas", () => {
    let st = grid([[1, "=A1*2"], [5]], "B1");
    st = keys(st, "ctrl+c, ArrowDown, ctrl+v");
    expect(raw(st, "B2")).toBe("=A2*2");
    expect(cell(st, "B2")?.value).toBe(10);
  });
  it("copy keeps marching ants for repeated pastes", () => {
    let st = keys(grid([["x"]]), "ctrl+c, ArrowDown, ctrl+v, ArrowDown, ctrl+v");
    expect(raw(st, "A3")).toBe("x");
    expect(st.clipboard).not.toBeNull();
  });
  it("Esc clears the marching ants", () => expect(keys(grid([["x"]]), "ctrl+c, Escape").clipboard).toBeNull());
  it("one cell pasted into a selection fills it", () => {
    const st = keys(grid([[7]]), "ctrl+c, ArrowDown, shift+ArrowDown, shift+ArrowDown, ctrl+v");
    expect([raw(st, "A2"), raw(st, "A3"), raw(st, "A4")]).toEqual(["7", "7", "7"]);
  });
  it("cut/paste moves cells and keeps formulas exactly", () => {
    let st = grid([[1, "=A1*2"]], "B1");
    st = keys(st, "ctrl+x, ArrowDown, ArrowDown, ctrl+v");
    expect([raw(st, "B1"), raw(st, "B3")]).toEqual(["", "=A1*2"]);
    expect(st.clipboard).toBeNull();
  });
  it("paste then undo restores", () => {
    const st = keys(grid([["a"], ["b"]]), "ctrl+c, ArrowDown, ctrl+v, ctrl+z");
    expect(raw(st, "A2")).toBe("b");
  });
  it("Mac Cmd+C / Cmd+V", () => {
    const st = keys(grid([["m"]]), "meta+c, ArrowRight, meta+v", mac);
    expect(raw(st, "B1")).toBe("m");
  });
  it("pasted range becomes the selection", () => {
    const st = keys(grid([[1, 2]]), "shift+ArrowRight, ctrl+c, ArrowDown, ctrl+v");
    expect(sel(st)).toBe("A2:B2");
  });
});

describe("paste special", () => {
  const src = () => grid([[2, "=A1*10"]], "B1");
  it("Ctrl+Alt+V, V, Enter pastes values", () => {
    const st = keys(src(), "ctrl+c, ArrowDown, ctrl+alt+v, v, Enter");
    expect(raw(st, "B2")).toBe("20");
    expect(cell(st, "B2")?.value).toBe(20);
    expect(st.dialog).toBeNull();
  });
  it("values over the same cell kill the formula", () => {
    const st = keys(src(), "ctrl+c, ctrl+alt+v, v, Enter");
    expect(raw(st, "B1")).toBe("20");
  });
  it("F pastes formulas (shifted) and keeps target format", () => {
    let st = keys(src(), "ArrowDown, ctrl+b, ArrowUp");
    st = keys(st, "ctrl+c, ArrowDown, ctrl+alt+v, f, Enter");
    expect(raw(st, "B2")).toBe("=A2*10");
    expect(cell(st, "B2")?.format.bold).toBe(true);
  });
  it("T pastes formats only", () => {
    let st = grid([["h", "data"]]);
    st = keys(st, "ctrl+b, ctrl+c, ArrowRight, ctrl+alt+v, t, Enter");
    expect(raw(st, "B1")).toBe("data");
    expect(cell(st, "B1")?.format.bold).toBe(true);
  });
  it("Esc closes the dialog without pasting", () => {
    const st = keys(src(), "ctrl+c, ArrowDown, ctrl+alt+v, Escape");
    expect(st.dialog).toBeNull();
    expect(raw(st, "B2")).toBe("");
  });
  it("Alt, E, S opens it too (legacy keytip)", () => {
    let st = keys(src(), "ctrl+c, ArrowDown");
    st = keys(st, "AltLeft, e, s");
    expect(st.dialog).toMatchObject({ kind: "pasteSpecial" });
  });
  it("Mac Cmd+Ctrl+V opens it", () => expect(keys(src(), "meta+c, meta+ctrl+v", mac).dialog).toMatchObject({ kind: "pasteSpecial" }));
  it("without a copy, nothing opens", () => expect(keys(src(), "ctrl+alt+v").dialog).toBeNull());
});

describe("insert / delete rows and columns", () => {
  const model = () => grid([["Rev", 100], ["Cost", -40], ["Profit", "=B1+B2"], ["Total", "=SUM(B1:B3)"]], "A2");
  it("Shift+Space, Ctrl+Shift+= inserts a row and fixes formulas", () => {
    const st = keys(model(), "shift+Space, ctrl+shift+Equal");
    expect(raw(st, "A3")).toBe("Cost");
    expect(raw(st, "B4")).toBe("=B1+B3");
    expect(raw(st, "B5")).toBe("=SUM(B1:B4)");
    expect(cell(st, "B5")?.value).toBe(120);
  });
  it("Ctrl+- deletes the row; refs to it become #REF!", () => {
    const st = keys(model(), "shift+Space, ctrl+Minus");
    expect(raw(st, "B2")).toBe("=B1+#REF!");
    expect(cell(st, "B2")?.value).toEqual({ error: "#REF!" });
    expect(raw(st, "B3")).toBe("=SUM(B1:B2)");
  });
  it("partial selection opens the dialog; R + Enter inserts entire row", () => {
    let st = keys(model(), "ctrl+shift+Equal");
    expect(st.dialog).toMatchObject({ kind: "insert" });
    st = keys(st, "r, Enter");
    expect(raw(st, "A3")).toBe("Cost");
  });
  it("C in the dialog picks entire column", () => {
    const st = keys(model(), "ArrowRight, ctrl+Minus, c, Enter");
    expect(raw(st, "B1")).toBe("");
    expect(raw(st, "A1")).toBe("Rev");
  });
  it("Ctrl+Space then insert adds a column", () => {
    const st = keys(model(), "ctrl+Space, ctrl+shift+Equal");
    expect(raw(st, "B1")).toBe("Rev");
    expect(raw(st, "C3")).toBe("=C1+C2");
  });
  it("insert is undoable", () => expect(raw(keys(model(), "shift+Space, ctrl+shift+Equal, ctrl+z"), "A2")).toBe("Cost"));
  it("F4 repeats the insert", () => {
    // After the first insert: Rev, (blank), Cost, Profit, Total. F4 on A4 inserts above Profit.
    const st = keys(model(), "shift+Space, ctrl+shift+Equal, ArrowDown, ArrowDown, F4");
    expect([raw(st, "A4"), raw(st, "A5")]).toEqual(["", "Profit"]);
  });
  it("other sheets pointing here are fixed too", () => {
    const s1 = fillFromRows(createSheet("Data"), [[1], [2]]);
    const s2 = fillFromRows(createSheet("Calc"), [["=Data!A2"]]);
    let st = createState({ sheets: [s1, s2] });
    st = keys(st, "shift+Space, ctrl+shift+Equal");
    expect(getCell(st.sheets[1]!, parseA1("A1"))?.raw).toBe("=Data!A3");
    expect(getCell(st.sheets[1]!, parseA1("A1"))?.value).toBe(2);
  });
});

describe("AutoSum", () => {
  it("Alt+= sums the numbers above", () => {
    let st = keys(grid([["Q1"], [10], [20], [30]], "A5"), "alt+Equal");
    expect(st.editor?.text).toBe("=SUM(A2:A4)");
    st = keys(st, "Enter");
    expect(cell(st, "A5")?.value).toBe(60);
  });
  it("falls back to numbers on the left", () => {
    const st = keys(grid([[1, 2, 3]], "D1"), "alt+Equal");
    expect(st.editor?.text).toBe("=SUM(A1:C1)");
  });
  it("nothing to sum: =SUM() with the caret inside", () => {
    const st = keys(grid([]), "alt+Equal");
    expect(st.editor).toMatchObject({ text: "=SUM()", caret: 5 });
  });
  it("Mac Cmd+Shift+T", () => expect(keys(grid([[4], [5]], "A3"), "meta+shift+t", mac).editor?.text).toBe("=SUM(A1:A2)"));
});

describe("sheets", () => {
  it("Shift+F11 inserts a sheet and activates it", () => {
    const st = keys(grid([["a"]]), "shift+F11");
    expect(st.sheets.map((s) => s.name)).toEqual(["Sheet2", "Sheet1"]);
    expect(st.sheetIndex).toBe(0);
  });
  it("Ctrl+PgDn / Ctrl+PgUp switch sheets", () => {
    let st = keys(grid([["a"]]), "shift+F11, ctrl+PageDown");
    expect(raw(st, "A1")).toBe("a");
    st = keys(st, "ctrl+PageUp");
    expect(raw(st, "A1")).toBe("");
  });
  it("Mac Option+Right goes to the next sheet", () => {
    const st = keys(grid([["a"]]), "shift+F11, alt+ArrowRight", mac);
    expect(st.sheetIndex).toBe(1);
  });
  it("cannot move past the last sheet", () => expect(keys(grid([]), "ctrl+PageDown").sheetIndex).toBe(0));
  it("undo removes the inserted sheet", () => expect(keys(grid([]), "shift+F11, ctrl+z").sheets).toHaveLength(1));
});

describe("show formulas", () => {
  it("Ctrl+` shows formula text", () => {
    const st = keys(grid([[2, "=A1*3"]]), "ctrl+Backquote");
    expect(displayText(cell(st, "B1"), st.showFormulas)).toBe("=A1*3");
  });
});

describe("cut-paste moves references with the cells (Excel semantics)", () => {
  it("a formula pointing at the moved cell follows it", () => {
    let st = grid([[5, "=A1*2"]]);
    st = keys(st, "ctrl+x, ArrowDown, ArrowDown, ctrl+v"); // A1 → A3
    expect(raw(st, "B1")).toBe("=A3*2");
    expect(cell(st, "B1")?.value).toBe(10);
  });
  it("a range fully inside the moved block follows; one straddling its edge stays", () => {
    let st = grid([[1, null, "=SUM(A1:A2)", "=SUM(A1:A3)"], [2], [3]]);
    st = keys(st, "shift+ArrowDown, ctrl+x, ArrowRight, ctrl+v"); // A1:A2 → B1:B2
    expect(raw(st, "C1")).toBe("=SUM(B1:B2)");
    expect(raw(st, "D1")).toBe("=SUM(A1:A3)");
    expect(cell(st, "C1")?.value).toBe(3);
  });
  it("formulas on other sheets that point here follow too", () => {
    const s1 = fillFromRows(createSheet("Data"), [[7]]);
    const s2 = fillFromRows(createSheet("Calc"), [["=Data!A1+1"]]);
    let st = createState({ sheets: [s1, s2] });
    st = keys(st, "ctrl+x, ArrowRight, ctrl+v");
    expect(getCell(st.sheets[1]!, parseA1("A1"))?.raw).toBe("=Data!B1+1");
    expect(getCell(st.sheets[1]!, parseA1("A1"))?.value).toBe(8);
  });
  it("copy-paste does not touch other formulas", () => {
    const st = keys(grid([[5, "=A1*2"]]), "ctrl+c, ArrowDown, ctrl+v");
    expect(raw(st, "B1")).toBe("=A1*2");
  });
  it("undo puts the references back", () => {
    const st = keys(grid([[5, "=A1*2"]]), "ctrl+x, ArrowDown, ctrl+v, ctrl+z");
    expect(raw(st, "B1")).toBe("=A1*2");
  });
});
