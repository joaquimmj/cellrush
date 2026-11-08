import { createSheet, fillFromRows, type CellAddr } from "@cellrush/engine";
import { A1, at, isReady, makeTable, near, rawAt, stateOf, times, valueAt } from "../data";
import { defineTask, type Task } from "../types";

type Calc = { cell: CellAddr; expected: number; note?: string };
const isFormulaWith = (st: Parameters<Task["check"]>[0], p: Calc) => isReady(st) && rawAt(st, p.cell).startsWith("=") && near(valueAt(st, p.cell), p.expected);

export const formulaTasks: Task[] = [
  defineTask<Calc>({
    id: "autosum-column",
    category: "formulas",
    difficulty: 1,
    prompt: (p) => `Total the column above in ${A1(p.cell)} with a formula`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const c = rng.int(t.numbers.c1, t.numbers.c2);
      let expected = 0;
      const st = stateOf(t.sheet, at(t.range.r2 + 1, c), ctx);
      for (let r = t.numbers.r1; r <= t.numbers.r2; r++) expected += Number(valueAt(st, at(r, c)));
      return { state: st, params: { cell: at(t.range.r2 + 1, c), expected } };
    },
    check: isFormulaWith,
    optimal: () => ({ win: ["alt+Equal", "Enter"], mac: ["meta+shift+t", "Enter"] }),
    requires: ["autosum"],
  }),
  defineTask<Calc>({
    id: "average-column",
    category: "formulas",
    difficulty: 2,
    prompt: (p) => `In ${A1(p.cell)}, compute the AVERAGE of the numbers above`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const c = rng.int(t.numbers.c1, t.numbers.c2);
      const cell = at(t.range.r2 + 1, c);
      const st = stateOf(t.sheet, cell, ctx);
      let sum = 0;
      for (let r = t.numbers.r1; r <= t.numbers.r2; r++) sum += Number(valueAt(st, at(r, c)));
      return { state: st, params: { cell, expected: sum / (t.numbers.r2 - t.numbers.r1 + 1) } };
    },
    check: isFormulaWith,
    // Point mode: ↑ picks the cell above, Ctrl/Cmd+Shift+↑ stretches the range to the top of the block.
    optimal: () => ({
      win: ["type:=AVERAGE(", "ArrowUp", "ctrl+shift+ArrowUp", "type:)", "Enter"],
      mac: ["type:=AVERAGE(", "ArrowUp", "meta+shift+ArrowUp", "type:)", "Enter"],
    }),
    requires: ["jump-extend-up"],
  }),
  defineTask<Calc>({
    id: "growth-formula",
    category: "formulas",
    difficulty: 2,
    prompt: (p) => `In ${A1(p.cell)}, compute growth vs the previous year (${p.note})`,
    setup(rng, ctx) {
      const a = rng.int(500, 900);
      const b = rng.int(600, 1200);
      const sheet = fillFromRows(createSheet(), [["", "FY24", "FY25"], ["Revenue", a, b], ["Growth"]]);
      return { state: stateOf(sheet, at(2, 2), ctx), params: { cell: at(2, 2), expected: b / a - 1, note: "C2/B2-1" } };
    },
    check: isFormulaWith,
    optimal: () => ({
      win: ["type:=", "ArrowUp", "type:/", "ArrowUp", "ArrowLeft", "type:-1", "Enter"],
      mac: ["type:=", "ArrowUp", "type:/", "ArrowUp", "ArrowLeft", "type:-1", "Enter"],
    }),
    requires: ["commit-down"],
  }),
  defineTask<Calc>({
    id: "margin-formula",
    category: "formulas",
    difficulty: 2,
    prompt: (p) => `In ${A1(p.cell)}, compute the gross margin (${p.note})`,
    setup(rng, ctx) {
      const rev = rng.int(800, 2000);
      const cogs = -rng.int(200, 700);
      const sheet = fillFromRows(createSheet(), [["Revenue", rev], ["COGS", cogs], ["Gross profit", "=B1+B2"], [], ["Margin"]]);
      return { state: stateOf(sheet, at(4, 1), ctx), params: { cell: at(4, 1), expected: (rev + cogs) / rev, note: "B3/B1" } };
    },
    check: isFormulaWith,
    optimal: () => ({
      win: ["type:=", ...times(2, "ArrowUp"), "type:/", ...times(4, "ArrowUp"), "Enter"],
      mac: ["type:=", ...times(2, "ArrowUp"), "type:/", ...times(4, "ArrowUp"), "Enter"],
    }),
    requires: ["commit-down"],
  }),
  defineTask<Calc>({
    id: "round-formula",
    category: "formulas",
    difficulty: 2,
    prompt: (p) => `In ${A1(p.cell)}, round the number on its left to 0 decimals with ROUND`,
    setup(rng, ctx) {
      const v = rng.int(1000, 99999) / 100;
      const sheet = fillFromRows(createSheet(), [[v]], at(1, 0));
      return { state: stateOf(sheet, at(1, 1), ctx), params: { cell: at(1, 1), expected: Math.round(v) } };
    },
    check: (st, p) => isFormulaWith(st, p) && /^=ROUND\(/i.test(rawAt(st, p.cell)),
    optimal: () => ({ win: ["type:=ROUND(", "ArrowLeft", "type:,0)", "Enter"], mac: ["type:=ROUND(", "ArrowLeft", "type:,0)", "Enter"] }),
    requires: ["commit-down"],
  }),
  defineTask<{ cell: CellAddr; want: string }>({
    id: "anchor-reference",
    category: "formulas",
    difficulty: 2,
    prompt: (p) => `Anchor the growth-rate reference in ${A1(p.cell)} so it won't move (make it $B$1)`,
    setup(rng, ctx) {
      const rate = rng.int(2, 12) / 100;
      const n = rng.int(2, 4);
      const row: (string | number)[] = ["Revenue", ...Array.from({ length: n }, () => rng.int(500, 1500))];
      const sheet = fillFromRows(createSheet(), [["Growth", rate], [], row, ["Next year", "=B3*(1+B1)"]]);
      return { state: stateOf(sheet, at(3, 1), ctx), params: { cell: at(3, 1), want: "=B3*(1+$B$1)" } };
    },
    check: (st, p) => isReady(st) && rawAt(st, p.cell) === p.want,
    optimal: () => ({ win: ["F2", "ArrowLeft", "F4", "Enter"], mac: ["F2", "ArrowLeft", "F4", "Enter"] }),
    requires: ["edit-cell", "repeat"],
  }),
  defineTask<{ on: boolean }>({
    id: "show-formulas",
    category: "formulas",
    difficulty: 1,
    prompt: () => "Show the formulas instead of their results",
    setup(rng, ctx) {
      const t = makeTable(rng);
      return { state: stateOf(t.sheet, t.origin, ctx), params: { on: true } };
    },
    check: (st) => isReady(st) && st.showFormulas,
    optimal: () => ({ win: ["ctrl+Backquote"], mac: ["ctrl+Backquote"] }),
    requires: ["show-formulas"],
  }),
];

type SheetP = { want: number; names: string[] };

function sheetsSetup(rng: Parameters<Task["setup"]>[0], ctx: Parameters<Task["setup"]>[1], start: number) {
  const names = rng.shuffle(["Inputs", "Model", "Summary", "Data", "Notes"]).slice(0, 3);
  const sheets = names.map((name) => makeTable(rng, { sheet: createSheet(name) }).sheet);
  const st = stateOf(sheets, at(0, 0), ctx);
  return { st: { ...st, sheetIndex: start }, names };
}

export const sheetTasks: Task[] = [
  defineTask<SheetP>({
    id: "next-sheet",
    category: "sheets",
    difficulty: 1,
    prompt: (p) => `Go to the next sheet (“${p.names[p.want]}”)`,
    setup(rng, ctx) {
      const s = sheetsSetup(rng, ctx, 0);
      return { state: s.st, params: { want: 1, names: s.names } };
    },
    check: (st, p) => isReady(st) && st.sheetIndex === p.want,
    optimal: () => ({ win: ["ctrl+PageDown"], mac: ["ctrl+PageDown"] }),
    requires: ["next-sheet"],
  }),
  defineTask<SheetP>({
    id: "prev-sheet",
    category: "sheets",
    difficulty: 1,
    prompt: (p) => `Go back to the previous sheet (“${p.names[p.want]}”)`,
    setup(rng, ctx) {
      const s = sheetsSetup(rng, ctx, 2);
      return { state: s.st, params: { want: 1, names: s.names } };
    },
    check: (st, p) => isReady(st) && st.sheetIndex === p.want,
    optimal: () => ({ win: ["ctrl+PageUp"], mac: ["ctrl+PageUp"] }),
    requires: ["prev-sheet"],
  }),
  defineTask<SheetP>({
    id: "insert-sheet",
    category: "sheets",
    difficulty: 1,
    prompt: () => "Insert a new worksheet",
    setup(rng, ctx) {
      const s = sheetsSetup(rng, ctx, 0);
      return { state: s.st, params: { want: 4, names: s.names } };
    },
    check: (st, p) => isReady(st) && st.sheets.length === p.want,
    optimal: () => ({ win: ["shift+F11"], mac: ["shift+F11"] }),
    requires: ["insert-sheet"],
  }),
];
