import { describe, expect, it } from "vitest";
import { dateToSerial, displayText } from "../src";
import { at, cell, grid, keys, raw, sel, type } from "./helpers";

describe("edit modes", () => {
  it("typing enters Enter mode and overwrites", () => {
    const st = type(grid([["old"]]), "new");
    expect(st.mode).toBe("enter");
    expect(st.editor?.text).toBe("new");
    expect(raw(keys(st, "Enter"), "A1")).toBe("new");
  });
  it("Enter commits and moves down", () => expect(at(keys(type(grid([]), "1"), "Enter"))).toBe("A2"));
  it("Shift+Enter commits and moves up", () => expect(at(keys(type(grid([], "A3"), "1"), "shift+Enter"))).toBe("A2"));
  it("Tab commits and moves right", () => expect(at(keys(type(grid([]), "1"), "Tab"))).toBe("B1"));
  it("Shift+Tab commits and moves left", () => expect(at(keys(type(grid([], "C1"), "1"), "shift+Tab"))).toBe("B1"));
  it("arrow in Enter mode commits and moves", () => {
    const st = keys(type(grid([]), "7"), "ArrowRight");
    expect(raw(st, "A1")).toBe("7");
    expect(at(st)).toBe("B1");
    expect(st.mode).toBe("ready");
  });
  it("Esc cancels", () => {
    const st = keys(type(grid([["keep"]]), "zzz"), "Escape");
    expect(raw(st, "A1")).toBe("keep");
    expect(st.mode).toBe("ready");
  });
  it("F2 edits existing content with caret at end", () => {
    const st = type(keys(grid([["abc"]]), "F2"), "d");
    expect(st.mode).toBe("edit");
    expect(st.editor?.text).toBe("abcd");
  });
  it("arrows move the caret in Edit mode", () => {
    const st = type(keys(grid([["abc"]]), "F2, ArrowLeft, ArrowLeft"), "X");
    expect(st.editor?.text).toBe("aXbc");
  });
  it("Home/End move the caret in Edit mode", () => {
    let st = type(keys(grid([["abc"]]), "F2, Home"), "<");
    st = type(keys(st, "End"), ">");
    expect(st.editor?.text).toBe("<abc>");
  });
  it("F2 toggles Edit → Enter so arrows commit", () => {
    const st = keys(grid([["abc"]]), "F2, F2, ArrowDown");
    expect(at(st)).toBe("A2");
  });
  it("Backspace in ready mode clears and edits", () => {
    const st = keys(grid([["abc"]]), "Backspace");
    expect(st.editor?.text).toBe("");
    expect(raw(keys(st, "Enter"), "A1")).toBe("");
  });
  it("Backspace / Delete edit text", () => {
    const st = keys(type(grid([]), "abcd"), "Backspace, F2, Home, Delete");
    expect(st.editor?.text).toBe("bc");
  });
  it("Shift+Space types a space while editing", () => {
    const st = keys(type(grid([]), "a"), "shift+Space");
    expect(st.editor?.text).toBe("a ");
  });
  it("Alt+Enter inserts a line break", () => {
    const st = keys(type(grid([]), "a"), "alt+Enter");
    expect(raw(keys(type(st, "b"), "Enter"), "A1")).toBe("a\nb");
  });
  it("Mac Option+Return inserts a line break", () => {
    const st = keys(type(grid([]), "a", { platform: "mac" }), "alt+Enter", { platform: "mac" });
    expect(st.editor?.text).toBe("a\n");
  });
  it("Delete in ready mode clears the selection but keeps formats", () => {
    let st = keys(grid([["a", "b"]]), "ctrl+b, shift+ArrowRight, Delete");
    expect(raw(st, "A1")).toBe("");
    expect(raw(st, "B1")).toBe("");
    expect(cell(st, "A1")?.format.bold).toBe(true);
    st = keys(st, "ctrl+z");
    expect(raw(st, "B1")).toBe("b");
  });
  it("numbers are parsed on commit", () => expect(cell(keys(type(grid([]), "42"), "Enter"), "A1")?.value).toBe(42));
});

describe("Enter inside a multi-cell selection", () => {
  it("walks down columns and wraps", () => {
    let st = keys(grid([], "A1"), "shift+ArrowDown, shift+ArrowRight"); // A1:B2
    st = keys(st, "Enter, Enter, Enter");
    expect(at(st)).toBe("B2");
    expect(sel(st)).toBe("A1:B2");
    expect(at(keys(st, "Enter"))).toBe("A1");
  });
  it("Tab walks across rows", () => {
    const st = keys(grid([]), "shift+ArrowDown, shift+ArrowRight, Tab");
    expect(at(st)).toBe("B1");
  });
  it("typing then Enter fills cells one by one inside the selection", () => {
    let st = keys(grid([]), "shift+ArrowDown");
    st = keys(type(st, "1"), "Enter");
    st = keys(type(st, "2"), "Enter");
    expect([raw(st, "A1"), raw(st, "A2")]).toEqual(["1", "2"]);
    expect(at(st)).toBe("A1");
  });
});

describe("Ctrl+Enter / Ctrl+D / Ctrl+R", () => {
  it("Ctrl+Enter fills the whole selection and keeps it", () => {
    const st = keys(type(keys(grid([]), "shift+ArrowDown, shift+ArrowDown"), "x"), "ctrl+Enter");
    expect([raw(st, "A1"), raw(st, "A2"), raw(st, "A3")]).toEqual(["x", "x", "x"]);
    expect(sel(st)).toBe("A1:A3");
  });
  it("Mac Cmd+Return fills the selection", () => {
    const mac = { platform: "mac" as const };
    const st = keys(type(keys(grid([]), "shift+ArrowRight", mac), "y", mac), "meta+Enter", mac);
    expect([raw(st, "A1"), raw(st, "B1")]).toEqual(["y", "y"]);
  });
  it("Ctrl+D copies the top row down", () => {
    const st = keys(grid([["a", "b"]]), "shift+ArrowRight, shift+ArrowDown, shift+ArrowDown, ctrl+d");
    expect([raw(st, "A3"), raw(st, "B3")]).toEqual(["a", "b"]);
  });
  it("Ctrl+D on one cell copies from above", () => expect(raw(keys(grid([["top"]], "A2"), "ctrl+d"), "A2")).toBe("top"));
  it("Ctrl+D copies formats", () => expect(cell(keys(grid([["a"]]), "ctrl+b, shift+ArrowDown, ctrl+d"), "A2")?.format.bold).toBe(true));
  it("Ctrl+D on row 1 single cell does nothing", () => expect(keys(grid([["a"]]), "ctrl+d").undo).toHaveLength(0));
  it("Ctrl+R copies the left column right", () => {
    const st = keys(grid([["a"], ["b"]]), "shift+ArrowDown, shift+ArrowRight, shift+ArrowRight, ctrl+r");
    expect([raw(st, "C1"), raw(st, "C2")]).toEqual(["a", "b"]);
  });
  it("Mac Cmd+D also fills down", () => expect(raw(keys(grid([["t"]], "A2"), "meta+d", { platform: "mac" }), "A2")).toBe("t"));
});

describe("Ctrl+; and Ctrl+'", () => {
  it("Ctrl+; types today's date (from options, not the clock)", () => {
    const st = keys(grid([]), "ctrl+;, Enter");
    expect(cell(st, "A1")?.value).toBe(dateToSerial(2026, 11, 8));
    expect(displayText(cell(st, "A1"))).toBe("11/8/2026");
  });
  it("Ctrl+' copies the exact formula from above", () => {
    const st = keys(grid([["=A1*2"]], "A2"), "ctrl+', Enter");
    expect(raw(st, "A2")).toBe("=A1*2");
  });
  it("Ctrl+; while editing inserts at the caret", () => {
    const st = keys(type(grid([]), "x"), "ctrl+;");
    expect(st.editor?.text).toBe("x11/8/2026");
  });
});

describe("undo / redo / repeat", () => {
  it("undo restores contents and selection", () => {
    const st0 = grid([["a"]]);
    const st1 = keys(type(st0, "b"), "Enter");
    const st2 = keys(st1, "ctrl+z");
    expect(raw(st2, "A1")).toBe("a");
    expect(at(st2)).toBe("A1");
  });
  it("redo re-applies (Ctrl+Y on Windows)", () => {
    const st = keys(type(grid([["a"]]), "b"), "Enter, ctrl+z, ctrl+y");
    expect(raw(st, "A1")).toBe("b");
  });
  it("redo on mac: Cmd+Shift+Z", () => {
    const mac = { platform: "mac" as const };
    const st = keys(type(grid([["a"]]), "b", mac), "Enter, meta+z, meta+shift+z", mac);
    expect(raw(st, "A1")).toBe("b");
  });
  it("new edit clears the redo stack", () => {
    let st = keys(type(grid([]), "1"), "Enter, ctrl+z");
    st = keys(type(st, "2"), "Enter");
    expect(st.redo).toHaveLength(0);
  });
  it("undo with empty history is a no-op", () => {
    const st = grid([["a"]]);
    expect(keys(st, "ctrl+z")).toEqual(st);
  });
  it("multiple undos walk back in order", () => {
    let st = keys(type(grid([]), "1"), "Enter");
    st = keys(type(st, "2"), "Enter");
    st = keys(st, "ctrl+z, ctrl+z");
    expect([raw(st, "A1"), raw(st, "A2")]).toEqual(["", ""]);
  });
  it("F4 repeats the last formatting action on a new cell", () => {
    const st = keys(grid([["a", "b"]]), "ctrl+b, ArrowRight, F4");
    expect(cell(st, "B1")?.format.bold).toBe(true);
  });
  it("F4 repeats a fill", () => {
    const st = keys(grid([["a", "b"]], "A2"), "ctrl+d, ArrowRight, F4");
    expect(raw(st, "B2")).toBe("b");
  });
  it("Ctrl+Y repeats when there is nothing to redo", () => {
    const st = keys(grid([["a", "b"]]), "ctrl+i, ArrowRight, ctrl+y");
    expect(cell(st, "B1")?.format.italic).toBe(true);
  });
  it("F4 with no history does nothing", () => expect(keys(grid([]), "F4").undo).toHaveLength(0));
  it("undo history is capped", () => {
    let st = grid([]);
    st = { ...st, options: { ...st.options, undoLimit: 3 } };
    for (let i = 0; i < 5; i++) st = keys(type(st, String(i)), "Enter");
    expect(st.undo).toHaveLength(3);
  });
  it("the reducer never mutates its input", () => {
    const st0 = grid([["a"]]);
    const snapshot = JSON.stringify(st0);
    keys(type(st0, "zz"), "Enter, ctrl+b, ctrl+d, Delete, ctrl+z");
    expect(JSON.stringify(st0)).toBe(snapshot);
  });
});

describe("formatting", () => {
  it("Ctrl+B toggles bold across the selection based on the active cell", () => {
    let st = keys(grid([["a", "b"]]), "shift+ArrowRight, ctrl+b");
    expect([cell(st, "A1")?.format.bold, cell(st, "B1")?.format.bold]).toEqual([true, true]);
    st = keys(st, "ctrl+b");
    expect(cell(st, "B1")?.format.bold).toBe(false);
  });
  it("Ctrl+I / Ctrl+U", () => {
    const st = keys(grid([["a"]]), "ctrl+i, ctrl+u");
    expect(cell(st, "A1")?.format).toMatchObject({ italic: true, underline: true });
  });
  it("Mac Cmd+B, and Cmd+U underlines", () => {
    const st = keys(grid([["a"]]), "meta+b, meta+u", { platform: "mac" });
    expect(cell(st, "A1")?.format).toMatchObject({ bold: true, underline: true });
  });
  it("Mac Ctrl+U edits the cell, not underline", () => {
    const st = keys(grid([["a"]]), "ctrl+u", { platform: "mac" });
    expect(st.mode).toBe("edit");
  });
  it.each([
    ["ctrl+shift+Digit1", "number", "1,234.50"],
    ["ctrl+shift+Digit4", "currency", "$1,234.50"],
    ["ctrl+shift+Digit5", "percent", "123450%"],
    ["ctrl+shift+Backquote", "general", "1234.5"],
  ])("%s → %s", (k, fmt, shown) => {
    const st = keys(grid([[1234.5]]), k);
    expect(cell(st, "A1")?.format.numberFormat).toBe(fmt);
    expect(displayText(cell(st, "A1"))).toBe(shown);
  });
  it("Ctrl+Shift+# formats as date", () => {
    const st = keys(grid([[46023]]), "ctrl+shift+Digit3");
    expect(displayText(cell(st, "A1"))).toBe("1/1/2026");
  });
  it("number-format shortcuts are positional on AZERTY", () => {
    const st = keys(grid([[0.25]]), "ctrl+shift+Digit5", { layout: "fr-azerty" });
    expect(displayText(cell(st, "A1"))).toBe("25%");
  });
  it("formatting empty cells creates styled blanks", () => {
    const st = keys(grid([]), "ctrl+b");
    expect(cell(st, "A1")).toMatchObject({ raw: "", format: { bold: true } });
  });
  it("Ctrl+` toggles show formulas", () => expect(keys(grid([]), "ctrl+Backquote").showFormulas).toBe(true));
});
