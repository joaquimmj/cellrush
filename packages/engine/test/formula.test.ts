import { describe, expect, it } from "vitest";
import { FormulaSyntaxError, createSheet, createState, fillFromRows, getCell, parseA1, parseFormula, tokenize, displayText, generalNumber } from "../src";
import { cell, grid } from "./helpers";

/** Evaluate a formula placed in Z1 of a sheet seeded with `rows`. */
function calc(formula: string, rows: ReadonlyArray<ReadonlyArray<string | number | null>> = []) {
  const st = grid([...rows]);
  const sheet = { ...st.sheets[0]!, cells: { ...st.sheets[0]!.cells } };
  const seeded = fillFromRows(sheet, [[formula]], parseA1("Z1"));
  const st2 = createState({ sheets: [seeded] });
  return getCell(st2.sheets[0]!, parseA1("Z1"))!.value;
}

describe("tokenizer", () => {
  it("splits operators, refs, numbers, strings, names", () => {
    expect(tokenize('SUM(A1:$B$2)*1.5&"x"').map((t) => t.t)).toEqual(["name", "(", "ref", "op", "ref", ")", "op", "num", "op", "str"]);
  });
  it("reads anchoring flags", () => {
    const [t] = tokenize("$C7");
    expect(t).toMatchObject({ t: "ref", c: 2, r: 6, absC: true, absR: false });
  });
  it("reads sheet prefixes, quoted or not", () => {
    expect(tokenize("Sheet2!A1")[0]).toMatchObject({ sheet: "Sheet2", prefix: "Sheet2!" });
    expect(tokenize("'My Sheet'!B2")[0]).toMatchObject({ sheet: "My Sheet", c: 1, r: 1 });
  });
  it("two-char operators", () => expect(tokenize("1<>2").map((t) => (t.t === "op" ? t.v : t.t))).toEqual(["num", "<>", "num"]));
  it("escaped quotes in strings", () => expect(tokenize('"a""b"')[0]).toMatchObject({ t: "str", v: 'a"b' }));
  it("function-like names are not refs (LOG10)", () => expect(tokenize("LOG10(1)")[0]).toMatchObject({ t: "name", v: "LOG10" }));
  it("error literals", () => expect(tokenize("#DIV/0!")[0]).toMatchObject({ t: "err", v: "#DIV/0!" }));
  it("rejects stray characters", () => expect(() => tokenize("1 @ 2")).toThrow(FormulaSyntaxError));
  it("rejects unterminated strings", () => expect(() => tokenize('"abc')).toThrow(FormulaSyntaxError));
});

describe("parser", () => {
  it("precedence: * before +", () => expect(parseFormula("1+2*3")).toMatchObject({ k: "bin", op: "+", r: { k: "bin", op: "*" } }));
  it("left-associative ^", () => expect(parseFormula("2^3^2")).toMatchObject({ k: "bin", op: "^", l: { k: "bin", op: "^" } }));
  it("unary minus binds tighter than ^", () => expect(parseFormula("-2^2")).toMatchObject({ k: "bin", op: "^", l: { k: "neg" } }));
  it("ranges", () => expect(parseFormula("A1:B3")).toMatchObject({ k: "range", from: { r: 0, c: 0 }, to: { r: 2, c: 1 } }));
  it("range end inherits the sheet", () => expect(parseFormula("Sheet2!A1:B2")).toMatchObject({ k: "range", to: { sheet: "Sheet2" } }));
  it("calls with no args", () => expect(parseFormula("SUM()")).toEqual({ k: "call", name: "SUM", args: [] }));
  it.each(["1+", "SUM(1,", "(1", "1)", "A1:", "*2", "FOO"])("syntax error: %s", (src) => expect(() => parseFormula(src)).toThrow(FormulaSyntaxError));
});

describe("evaluator — arithmetic", () => {
  it.each([
    ["=1+2*3", 7], ["=(1+2)*3", 9], ["=2^3^2", 64], ["=-2^2", 4], ["=10/4", 2.5], ["=50%", 0.5], ["=200*10%", 20],
    ["=-(3)", -3], ["=+5", 5], ['="3"+1', 4], ["=TRUE+1", 2], ["=1=1", true], ['="a"="A"', true], ["=2<10", true],
    ['="10"<"9"', true], ['=1<"a"', true], ['="a"<TRUE', true], ["=1<>1", false],
  ])("%s → %j", (f, v) => expect(calc(f)).toEqual(v));
  it("& joins text with General numbers", () => expect(calc('="Q"&1&"="&0.1*3')).toBe("Q1=0.3"));
  it("float noise is hidden by General format", () => expect(generalNumber(0.1 + 0.2)).toBe("0.3"));
  it("references", () => expect(calc("=A1*B1", [[6, 7]])).toBe(42));
  it("empty reference counts as 0", () => expect(calc("=A1+1")).toBe(1));
  it("a formula that is just an empty ref shows 0", () => expect(calc("=A1")).toBe(0));
  it("formula chains", () => {
    const st = grid([[2, "=A1*10", "=B1+1"]]);
    expect(cell(st, "C1")?.value).toBe(21);
  });
});

describe("evaluator — errors", () => {
  it("#DIV/0!", () => expect(calc("=1/0")).toEqual({ error: "#DIV/0!" }));
  it("#VALUE! from text math", () => expect(calc('="abc"*2')).toEqual({ error: "#VALUE!" }));
  it("#NAME? for unknown functions", () => expect(calc("=NOPE(1)")).toEqual({ error: "#NAME?" }));
  it("#REF! for unknown sheets", () => expect(calc("=Missing!A1")).toEqual({ error: "#REF!" }));
  it("#REF! literal propagates", () => expect(calc("=#REF!+1")).toEqual({ error: "#REF!" }));
  it("#ERROR! for unparseable formulas", () => expect(calc("=1+")).toEqual({ error: "#ERROR!" }));
  it("errors propagate through refs", () => expect(calc("=A1+1", [["=1/0"]])).toEqual({ error: "#DIV/0!" }));
  it("a bare range in a scalar slot is #VALUE!", () => expect(calc("=A1:A2+1", [[1], [2]])).toEqual({ error: "#VALUE!" }));
  it("refs past the sheet edge are #REF!", () => expect(calc("=A100")).toEqual({ error: "#REF!" }));
});

describe("functions", () => {
  // Typed "4" is a number (as in Excel); "x" is text and TRUE a boolean, both skipped inside ranges.
  const data = [[1, 2, "x", null], [3, "4", "TRUE", 10]];
  it.each([
    ["=SUM(A1:D2)", 20], ["=SUM(1,2,3)", 6], ['=SUM("4",1)', 5], ["=SUM(A1:A2,10)", 14], ["=SUM(C1:C2)", 0],
    ["=AVERAGE(A1:B1)", 1.5], ["=MIN(A1:D2)", 1], ["=MAX(A1:D2)", 10], ["=COUNT(A1:D2)", 5], ["=COUNT(1,\"2\",\"x\")", 2],
    ["=ROUND(2.675,2)", 2.68], ["=ROUND(-2.5,0)", -3], ["=ROUND(1234.5,-2)", 1200], ["=ABS(-4)", 4],
    ["=IF(A1>0,\"pos\",\"neg\")", "pos"], ["=IF(A1>5,1)", false], ["=IF(0,1,2)", 2],
    ["=IFERROR(1/0,\"n/a\")", "n/a"], ["=IFERROR(5,0)", 5], ["=sum(1,1)", 2],
  ])("%s → %j", (f, v) => expect(calc(f, data)).toEqual(v));
  it("AVERAGE of nothing is #DIV/0!", () => expect(calc("=AVERAGE(Z5:Z6)")).toEqual({ error: "#DIV/0!" }));
  it("SUM propagates errors inside ranges", () => expect(calc("=SUM(A1:A2)", [["=1/0"], [1]])).toEqual({ error: "#DIV/0!" }));
  it("wrong arg count is #VALUE!", () => expect(calc("=ROUND(1)")).toEqual({ error: "#VALUE!" }));
  it("IF condition text is #VALUE!", () => expect(calc('=IF("maybe",1,2)')).toEqual({ error: "#VALUE!" }));
});

describe("recalc", () => {
  it("circular references show 0 and are reported", () => {
    const st = grid([["=B1", "=A1"]]);
    expect(cell(st, "A1")?.value).toBe(0);
    expect(st.circular).toEqual(["Sheet1!A1", "Sheet1!B1"]);
  });
  it("self reference", () => expect(grid([["=A1+1"]]).circular).toEqual(["Sheet1!A1"]));
  it("cross-sheet references", () => {
    const s1 = fillFromRows(createSheet("Inputs"), [[0.05]]);
    const s2 = fillFromRows(createSheet("Model"), [["=Inputs!A1*100", "='inputs'!A1"]]);
    const st = createState({ sheets: [s1, s2] });
    expect(getCell(st.sheets[1]!, parseA1("A1"))?.value).toBe(5);
    expect(getCell(st.sheets[1]!, parseA1("B1"))?.value).toBe(0.05);
  });
  it("unchanged sheets keep their identity", () => {
    const st = grid([[1]]);
    const again = createState({ sheets: [...st.sheets] });
    expect(again.sheets[0]).toBe(st.sheets[0]);
  });
  it("displays computed values", () => expect(displayText(cell(grid([[1, 2, "=A1/B1"]]), "C1"))).toBe("0.5"));
});
