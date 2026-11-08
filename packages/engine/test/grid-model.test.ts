import { describe, expect, it } from "vitest";
import {
  colToLetters, createSheet, dateToSerial, displayText, getCell, lettersToCol, makeCell, parseA1, parseRange, parseRaw,
  rangeToA1, setCells, serialToDate, isoToDateText, cellsIn, rangeSize,
} from "../src";

describe("addresses", () => {
  it.each([[0, "A"], [25, "Z"], [26, "AA"], [51, "AZ"], [52, "BA"], [701, "ZZ"], [702, "AAA"]])("col %i ↔ %s", (n, s) => {
    expect(colToLetters(n)).toBe(s);
    expect(lettersToCol(s)).toBe(n);
  });
  it("parses A1 and absolute refs", () => {
    expect(parseA1("B3")).toEqual({ r: 2, c: 1 });
    expect(parseA1("$C$10")).toEqual({ r: 9, c: 2 });
  });
  it("rejects garbage", () => expect(() => parseA1("3B")).toThrow());
  it("normalizes reversed ranges", () => expect(rangeToA1(parseRange("C5:A1"))).toBe("A1:C5"));
  it("single-cell range prints as a cell", () => expect(rangeToA1(parseRange("D4"))).toBe("D4"));
  it("iterates cells row-major", () => expect([...cellsIn(parseRange("A1:B2"))].length).toBe(4));
  it("rangeSize", () => expect(rangeSize(parseRange("B2:D5"))).toBe(12));
});

describe("parseRaw", () => {
  it.each([
    ["42", 42], ["-3.5", -3.5], ["1,234", 1234], ["(500)", -500], [".5", 0.5], ["TRUE", true], ["false", false], ["", null],
    ["hello", "hello"], ["12abc", "12abc"], ["1,23", "1,23"],
  ])("%j → %j", (input, value) => expect(parseRaw(input).value).toEqual(value));
  it("percent sets a format", () => expect(parseRaw("12.5%")).toEqual({ value: 0.125, format: { numberFormat: "percent" } }));
  it("formulas wait for the formula engine", () => expect(parseRaw("=A1+1").value).toBeNull());
  it("dates, m/d/y", () => expect(parseRaw("11/8/2026")).toEqual({ value: dateToSerial(2026, 11, 8), format: { numberFormat: "date" } }));
  it("dates, d/m/y", () => expect(parseRaw("08/11/2026", "dmy").value).toBe(dateToSerial(2026, 11, 8)));
  it("invalid month is text", () => expect(parseRaw("13/40/2026").value).toBe("13/40/2026"));
  it("makeCell keeps an existing format", () => {
    const prev = makeCell("1");
    const bold = { ...prev, format: { bold: true } };
    expect(makeCell("2", bold).format).toEqual({ bold: true });
  });
});

describe("displayText", () => {
  const c = (raw: string, format = {}) => ({ ...makeCell(raw), format });
  it("general", () => expect(displayText(c("3.25"))).toBe("3.25"));
  it("number", () => expect(displayText(c("1234.5", { numberFormat: "number" }))).toBe("1,234.50"));
  it("negative number", () => expect(displayText(c("-1234567", { numberFormat: "number" }))).toBe("-1,234,567.00"));
  it("currency in parentheses when negative", () => expect(displayText(c("-50", { numberFormat: "currency" }))).toBe("($50.00)"));
  it("percent with decimals", () => expect(displayText(c("0.1234", { numberFormat: "percent", decimals: 1 }))).toBe("12.3%"));
  it("date", () => expect(displayText(c(String(dateToSerial(2026, 1, 31)), { numberFormat: "date" }))).toBe("1/31/2026"));
  it("booleans", () => expect(displayText(c("true"))).toBe("TRUE"));
  it("formula text shown until evaluated", () => expect(displayText(c("=A1"))).toBe("=A1"));
  it("serial round trip", () => expect(serialToDate(dateToSerial(2024, 2, 29))).toBe("2/29/2024"));
  it("Excel serial for 2026-01-01", () => expect(dateToSerial(2026, 1, 1)).toBe(46023));
  it("iso → typed date text", () => {
    expect(isoToDateText("2026-11-08")).toBe("11/8/2026");
    expect(isoToDateText("2026-11-08", "dmy")).toBe("08/11/2026");
  });
});

describe("sheet immutability", () => {
  it("setCells returns a new sheet and leaves the old one alone", () => {
    const s0 = createSheet();
    const s1 = setCells(s0, [[parseA1("A1"), makeCell("x")]]);
    expect(getCell(s0, parseA1("A1"))).toBeUndefined();
    expect(getCell(s1, parseA1("A1"))?.raw).toBe("x");
  });
  it("undefined removes a cell", () => {
    const s1 = setCells(createSheet(), [[parseA1("A1"), makeCell("x")]]);
    expect(Object.keys(setCells(s1, [[parseA1("A1"), undefined]]).cells)).toHaveLength(0);
  });
});
