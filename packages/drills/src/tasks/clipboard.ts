import { createSheet, fillFromRows, type CellAddr, type Range } from "@cellrush/engine";
import { A1, R1, at, cellOf, company, everyCell, isReady, makeTable, near, rawAt, rect, stateOf, times, valueAt } from "../data";
import { defineTask, type Task } from "../types";

type Move = { from: CellAddr; to: CellAddr; raw: string; steps: number };

const copyWin = (steps: number, dir = "ArrowRight") => ["ctrl+c", ...times(steps, dir), "ctrl+v"];
const copyMac = (steps: number, dir = "ArrowRight") => ["meta+c", ...times(steps, dir), "meta+v"];

export const clipboardTasks: Task[] = [
  defineTask<Move>({
    id: "copy-cell",
    category: "clipboard",
    difficulty: 1,
    prompt: (p) => `Copy ${A1(p.from)} to ${A1(p.to)}`,
    setup(rng, ctx) {
      const from = at(rng.int(1, 8), rng.int(0, 2));
      const steps = rng.int(2, 4);
      const raw = company(rng);
      const sheet = fillFromRows(createSheet(), [[raw]], from);
      return { state: stateOf(sheet, from, ctx), params: { from, to: at(from.r, from.c + steps), raw, steps } };
    },
    check: (st, p) => isReady(st) && rawAt(st, p.to) === p.raw && rawAt(st, p.from) === p.raw,
    optimal: (p) => ({ win: copyWin(p.steps), mac: copyMac(p.steps) }),
    requires: ["copy", "paste"],
  }),
  defineTask<Move>({
    id: "copy-formula",
    category: "clipboard",
    difficulty: 2,
    prompt: (p) => `Copy the formula in ${A1(p.from)} to ${A1(p.to)} (references should follow)`,
    setup(rng, ctx) {
      const n = rng.int(3, 5);
      const rows: (string | number)[][] = [["Price", "Qty", "Total"]];
      for (let i = 0; i < n; i++) rows.push([rng.int(5, 50), rng.int(1, 20), i === 0 ? "=A2*B2" : ""]);
      const sheet = fillFromRows(createSheet(), rows);
      const steps = rng.int(1, n - 1);
      return { state: stateOf(sheet, at(1, 2), ctx), params: { from: at(1, 2), to: at(1 + steps, 2), raw: `=A${2 + steps}*B${2 + steps}`, steps } };
    },
    check: (st, p) => isReady(st) && near(valueAt(st, p.to), Number(valueAt(st, at(p.to.r, 0))) * Number(valueAt(st, at(p.to.r, 1)))) && rawAt(st, p.to).startsWith("="),
    optimal: (p) => ({ win: copyWin(p.steps, "ArrowDown"), mac: copyMac(p.steps, "ArrowDown") }),
    requires: ["copy", "paste"],
  }),
  defineTask<Move>({
    id: "cut-cell",
    category: "clipboard",
    difficulty: 1,
    prompt: (p) => `Move ${A1(p.from)} to ${A1(p.to)} (cut, don't copy)`,
    setup(rng, ctx) {
      const from = at(rng.int(1, 8), rng.int(0, 2));
      const steps = rng.int(2, 4);
      const raw = company(rng);
      const sheet = fillFromRows(createSheet(), [[raw]], from);
      return { state: stateOf(sheet, from, ctx), params: { from, to: at(from.r + steps, from.c), raw, steps } };
    },
    check: (st, p) => isReady(st) && rawAt(st, p.to) === p.raw && rawAt(st, p.from) === "",
    optimal: (p) => ({
      win: ["ctrl+x", ...times(p.steps, "ArrowDown"), "ctrl+v"],
      mac: ["meta+x", ...times(p.steps, "ArrowDown"), "meta+v"],
    }),
    requires: ["cut", "paste"],
  }),
  defineTask<{ range: Range; expected: number[] }>({
    id: "paste-values",
    category: "clipboard",
    difficulty: 3,
    prompt: (p) => `Replace the formulas in ${R1(p.range)} with their values`,
    setup(rng, ctx) {
      const n = rng.int(3, 6);
      const rows: (string | number)[][] = [["Units", "Price", "Revenue"]];
      const expected: number[] = [];
      for (let i = 0; i < n; i++) {
        const u = rng.int(10, 90);
        const pr = rng.int(5, 40);
        expected.push(u * pr);
        rows.push([u, pr, `=A${i + 2}*B${i + 2}`]);
      }
      const sheet = fillFromRows(createSheet(), rows);
      return { state: stateOf(sheet, at(1, 2), ctx), params: { range: rect(1, 2, n, 2), expected } };
    },
    check: (st, p) =>
      isReady(st) && everyCell(p.range, (a) => !rawAt(st, a).startsWith("=") && valueAt(st, a) === p.expected[a.r - p.range.r1]),
    optimal: () => ({
      win: ["ctrl+shift+ArrowDown", "ctrl+c", "ctrl+alt+v", "v", "Enter"],
      mac: ["meta+shift+ArrowDown", "meta+c", "meta+ctrl+v", "v", "Enter"],
    }),
    requires: ["jump-extend-down", "copy", "paste-special"],
  }),
  defineTask<Move>({
    id: "paste-formats",
    category: "clipboard",
    difficulty: 3,
    prompt: (p) => `Copy only the formatting of ${A1(p.from)} onto ${A1(p.to)} (keep its text)`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const from = t.origin;
      const sheet = {
        ...t.sheet,
        cells: Object.fromEntries(
          Object.entries(t.sheet.cells).map(([k, c]) => [k, k === `${from.r}:${from.c}` ? { ...c, format: { bold: true, italic: true } } : c]),
        ),
      };
      const steps = 2;
      const to = at(from.r + steps, from.c);
      const st = stateOf(sheet, from, ctx);
      return { state: st, params: { from, to, raw: rawAt(st, to), steps } };
    },
    check: (st, p) => isReady(st) && !!cellOf(st, p.to)?.format.bold && !!cellOf(st, p.to)?.format.italic && rawAt(st, p.to) === p.raw,
    optimal: (p) => ({
      win: ["ctrl+c", ...times(p.steps, "ArrowDown"), "ctrl+alt+v", "t", "Enter"],
      mac: ["meta+c", ...times(p.steps, "ArrowDown"), "meta+ctrl+v", "t", "Enter"],
    }),
    requires: ["copy", "paste-special"],
  }),
  defineTask<{ from: CellAddr; range: Range; raw: string; n: number }>({
    id: "paste-into-range",
    category: "clipboard",
    difficulty: 2,
    prompt: (p) => `Copy ${A1(p.from)} into every cell of ${R1(p.range)}`,
    setup(rng, ctx) {
      const from = at(rng.int(1, 5), rng.int(0, 3));
      const raw = String(rng.int(10, 99));
      const n = rng.int(2, 4);
      const sheet = fillFromRows(createSheet(), [[raw]], from);
      return { state: stateOf(sheet, from, ctx), params: { from, raw, n, range: rect(from.r + 1, from.c, from.r + 1 + n, from.c) } };
    },
    check: (st, p) => isReady(st) && everyCell(p.range, (a) => rawAt(st, a) === p.raw),
    optimal: (p) => ({
      win: ["ctrl+c", "ArrowDown", ...times(p.n, "shift+ArrowDown"), "ctrl+v"],
      mac: ["meta+c", "ArrowDown", ...times(p.n, "shift+ArrowDown"), "meta+v"],
    }),
    requires: ["copy", "extend-down", "paste"],
  }),
];
