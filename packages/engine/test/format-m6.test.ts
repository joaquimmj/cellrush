import { describe, expect, it } from "vitest";
import { PALETTE } from "../src";
import { cell, grid, keys } from "./helpers";

const BLUE = PALETTE.findIndex((c) => c.name === "Blue");

describe("borders", () => {
  it("Ctrl+Shift+& draws a box around the selection (outer edges only)", () => {
    const st = keys(grid([[1, 2], [3, 4]]), "shift+ArrowDown, shift+ArrowRight, ctrl+shift+Digit7");
    expect(cell(st, "A1")?.format.borders).toEqual({ top: true, left: true, bottom: undefined, right: undefined });
    expect(cell(st, "B2")?.format.borders).toEqual({ top: undefined, left: undefined, bottom: true, right: true });
  });
  it("a single cell gets all four sides", () =>
    expect(cell(keys(grid([[1]]), "ctrl+shift+Digit7"), "A1")?.format.borders).toEqual({ top: true, left: true, bottom: true, right: true }));
  it("Ctrl+Shift+_ removes them", () =>
    expect(cell(keys(grid([[1]]), "ctrl+shift+Digit7, ctrl+shift+Minus"), "A1")?.format.borders).toBeUndefined());
  it("Mac: Cmd+Option+0 / Cmd+Option+-", () => {
    const mac = { platform: "mac" as const };
    expect(cell(keys(grid([[1]]), "meta+alt+Digit0", mac), "A1")?.format.borders?.top).toBe(true);
    expect(cell(keys(grid([[1]]), "meta+alt+Digit0, meta+alt+Minus", mac), "A1")?.format.borders).toBeUndefined();
  });
  it("F4 repeats a border", () => expect(cell(keys(grid([[1, 2]]), "ctrl+shift+Digit7, ArrowRight, F4"), "B1")?.format.borders?.top).toBe(true));
  it("undo removes a border", () => expect(cell(keys(grid([[1]]), "ctrl+shift+Digit7, ctrl+z"), "A1")?.format.borders).toBeUndefined());
});

describe("colour palette (Alt, H, F, C / Alt, H, H)", () => {
  const toBlue = Array.from({ length: BLUE }, () => "ArrowRight").join(", ");
  it("opens on Automatic", () => expect(keys(grid([[1]]), "AltLeft, h, f, c").dialog).toEqual({ kind: "color", target: "font", index: 0 }));
  it("← → move, Enter applies the font colour", () => {
    const st = keys(grid([[1]]), `AltLeft, h, f, c, ${toBlue}, Enter`);
    expect(cell(st, "A1")?.format.fontColor).toBe("#0070C0");
    expect(st.dialog).toBeNull();
  });
  it("Alt, H, H fills the background", () => expect(cell(keys(grid([[1]]), "AltLeft, h, h, ArrowRight, ArrowRight, Enter"), "A1")?.format.fillColor).toBe("#FF0000"));
  it("Automatic clears the colour", () => {
    const st = keys(grid([[1]]), `AltLeft, h, f, c, ${toBlue}, Enter, AltLeft, h, f, c, Enter`);
    expect(cell(st, "A1")?.format.fontColor).toBeUndefined();
  });
  it("the cursor stops at both ends", () => {
    expect(keys(grid([[1]]), "AltLeft, h, f, c, ArrowLeft").dialog).toMatchObject({ index: 0 });
    const many = Array.from({ length: 20 }, () => "ArrowRight").join(", ");
    expect(keys(grid([[1]]), `AltLeft, h, f, c, ${many}`).dialog).toMatchObject({ index: PALETTE.length - 1 });
  });
  it("Esc closes without changing anything", () => {
    const st = keys(grid([[1]]), `AltLeft, h, f, c, ${toBlue}, Escape`);
    expect(st.dialog).toBeNull();
    expect(cell(st, "A1")?.format.fontColor).toBeUndefined();
  });
  it("F4 repeats the colour on another range", () => {
    const st = keys(grid([[1, 2]]), `AltLeft, h, f, c, ${toBlue}, Enter, ArrowRight, F4`);
    expect(cell(st, "B1")?.format.fontColor).toBe("#0070C0");
  });
  it("applies to the whole selection", () => {
    const st = keys(grid([[1, 2]]), `shift+ArrowRight, AltLeft, h, f, c, ${toBlue}, Enter`);
    expect([cell(st, "A1")?.format.fontColor, cell(st, "B1")?.format.fontColor]).toEqual(["#0070C0", "#0070C0"]);
  });
});
