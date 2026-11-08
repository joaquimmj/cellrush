import { describe, expect, it } from "vitest";
import { cycleAnchor, shiftFormula, structuralRewrite, type RefToken } from "../src";

const B = { rows: 60, cols: 26 };
const here = (_r: RefToken) => true;

describe("shiftFormula (fill / copy)", () => {
  it.each([
    ["=A1+B2", 1, 0, "=A2+B3"],
    ["=A1+B2", 0, 2, "=C1+D2"],
    ["=$A$1+B2", 3, 3, "=$A$1+E5"],
    ["=A$1*$A1", 2, 2, "=C$1*$A3"],
    ["=SUM(A1:A3)", 0, 1, "=SUM(B1:B3)"],
    ["=SUM($A1:A$3)", 1, 1, "=SUM($A2:B$3)"],
    ["=Sheet2!A1", 1, 0, "=Sheet2!A2"],
    ["=  A1 +  1", 1, 0, "=  A2 +  1"],
    ['="A1"&A1', 1, 0, '="A1"&A2'],
  ])("%s by (%i,%i) → %s", (f, dr, dc, out) => expect(shiftFormula(f, dr, dc, B)).toBe(out));
  it("off the sheet → #REF!", () => expect(shiftFormula("=A1+1", -1, 0, B)).toBe("=#REF!+1"));
  it("range partly off the sheet → #REF!", () => expect(shiftFormula("=SUM(A1:A2)", 0, -1, B)).toBe("=SUM(#REF!)"));
  it("non-formulas untouched", () => expect(shiftFormula("A1", 1, 1, B)).toBe("A1"));
  it("unparseable formulas untouched", () => expect(shiftFormula('="oops', 1, 1, B)).toBe('="oops'));
});

describe("structuralRewrite (insert / delete)", () => {
  const ins = (f: string, axis: "row" | "col", at: number, n: number) => structuralRewrite(f, axis, at, n, 60, here);
  it("insert row above a ref moves it, absolute too", () => expect(ins("=A5+$A$5", "row", 2, 1)).toBe("=A6+$A$6"));
  it("insert row below a ref leaves it", () => expect(ins("=A2", "row", 5, 3)).toBe("=A2"));
  it("insert inside a range grows it", () => expect(ins("=SUM(A2:A6)", "row", 3, 2)).toBe("=SUM(A2:A8)"));
  it("insert columns", () => expect(ins("=C1+A1", "col", 1, 1)).toBe("=D1+A1"));
  it("delete row of a ref → #REF!", () => expect(ins("=A3*2", "row", 2, -1)).toBe("=#REF!*2"));
  it("delete rows above a ref moves it up", () => expect(ins("=A10", "row", 2, -3)).toBe("=A7"));
  it("delete inside a range shrinks it", () => expect(ins("=SUM(A2:A10)", "row", 4, -2)).toBe("=SUM(A2:A8)"));
  it("delete the end of a range trims it", () => expect(ins("=SUM(A2:A6)", "row", 4, -5)).toBe("=SUM(A2:A4)"));
  it("delete the start of a range trims it", () => expect(ins("=SUM(A2:A6)", "row", 0, -3)).toBe("=SUM(A1:A3)"));
  it("delete the whole range → #REF!", () => expect(ins("=SUM(A2:A3)", "row", 0, -5)).toBe("=SUM(#REF!)"));
  it("refs to other sheets are left alone", () =>
    expect(structuralRewrite("=Other!A5+A5", "row", 0, 1, 60, (r) => r.sheet === undefined)).toBe("=Other!A5+A6"));
  it("insert pushing a ref off the sheet → #REF!", () => expect(ins("=A60", "row", 0, 1)).toBe("=#REF!"));
});

describe("cycleAnchor (F4 / Cmd+T)", () => {
  const f4 = (t: string, caret = t.length) => cycleAnchor(t, caret)?.text;
  it("A1 → $A$1 → A$1 → $A1 → A1", () => {
    let t = "=B2";
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      t = cycleAnchor(t, t.length)!.text;
      seen.push(t);
    }
    expect(seen).toEqual(["=$B$2", "=B$2", "=$B2", "=B2"]);
  });
  it("only the ref at the caret changes", () => expect(f4("=A1+B1", 3)).toBe("=$A$1+B1"));
  it("caret at the start of a ref works", () => expect(f4("=A1+B1", 4)).toBe("=A1+$B$1"));
  it("ranges toggle both ends", () => expect(f4("=SUM(A1:B3")).toBe("=SUM($A$1:$B$3"));
  it("caret lands after the ref", () => expect(cycleAnchor("=A1*2", 3)).toEqual({ text: "=$A$1*2", caret: 5 }));
  it("keeps sheet prefixes", () => expect(f4("=Sheet2!C3")).toBe("=Sheet2!$C$3"));
  it("no ref at caret → null", () => expect(cycleAnchor("=1+2", 3)).toBeNull());
  it("not a formula → null", () => expect(cycleAnchor("A1", 2)).toBeNull());
});
