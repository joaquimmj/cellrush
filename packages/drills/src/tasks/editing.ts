import { createSheet, dateToSerial, fillFromRows, reduce, type CellAddr, type Range } from "@cellrush/engine";
import { A1, R1, at, cellOf, company, cursorAt, everyCell, isReady, makeTable, near, rawAt, rect, stateOf, status, times, valueAt } from "../data";
import { defineTask, type Task } from "../types";

type One = { cell: CellAddr; text?: string; was?: string };

export const editingTasks: Task[] = [
  defineTask<One>({
    id: "type-number",
    category: "editing",
    difficulty: 1,
    prompt: (p) => `Type ${p.text} in ${A1(p.cell)} and press Enter`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const cell = at(t.range.r2 + 1, rng.int(t.numbers.c1, t.numbers.c2));
      return { state: stateOf(t.sheet, cell, ctx), params: { cell, text: String(rng.int(100, 999)) } };
    },
    check: (st, p) => isReady(st) && rawAt(st, p.cell) === p.text,
    optimal: (p) => ({ win: [`type:${p.text}`, "Enter"], mac: [`type:${p.text}`, "Enter"] }),
    requires: ["commit-down"],
  }),
  defineTask<One>({
    id: "replace-text",
    category: "editing",
    difficulty: 1,
    prompt: (p) => `Replace “${p.was}” with “Done” in ${A1(p.cell)}`,
    setup(rng, ctx) {
      const cell = at(rng.int(2, 8), rng.int(1, 4));
      const was = status(rng);
      const sheet = fillFromRows(createSheet(), [["Task", "Status"], [company(rng), was]], at(cell.r - 1, cell.c - 1));
      return { state: stateOf(sheet, cell, ctx), params: { cell, was } };
    },
    check: (st, p) => isReady(st) && rawAt(st, p.cell) === "Done",
    optimal: () => ({ win: ["type:Done", "Enter"], mac: ["type:Done", "Enter"] }),
    requires: ["commit-down"],
  }),
  defineTask<One>({
    id: "append-text",
    category: "editing",
    difficulty: 2,
    prompt: (p) => `Add “ Ltd” to the end of “${p.was}” in ${A1(p.cell)} (keep the name)`,
    setup(rng, ctx) {
      const cell = at(rng.int(1, 8), rng.int(0, 3));
      const was = company(rng);
      const sheet = fillFromRows(createSheet(), [[was]], cell);
      return { state: stateOf(sheet, cell, ctx), params: { cell, was } };
    },
    check: (st, p) => isReady(st) && rawAt(st, p.cell) === `${p.was} Ltd`,
    optimal: () => ({ win: ["F2", "type: Ltd", "Enter"], mac: ["F2", "type: Ltd", "Enter"] }),
    requires: ["edit-cell", "commit-down"],
  }),
  defineTask<One>({
    id: "edit-mode",
    category: "editing",
    difficulty: 1,
    prompt: (p) => `Open ${A1(p.cell)} for editing (Edit mode, caret at the end)`,
    setup(rng, ctx) {
      const cell = at(rng.int(1, 8), rng.int(0, 3));
      const sheet = fillFromRows(createSheet(), [[company(rng)]], cell);
      return { state: stateOf(sheet, cell, ctx), params: { cell } };
    },
    check: (st, p) => st.mode === "edit" && cursorAt(st, p.cell) && st.editor!.caret === st.editor!.text.length,
    optimal: () => ({ win: ["F2"], mac: ["F2"] }),
    requires: ["edit-cell"],
    allowEditing: true,
  }),
  defineTask<One>({
    id: "clear-cell",
    category: "editing",
    difficulty: 1,
    prompt: (p) => `Clear the contents of ${A1(p.cell)}`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const cell = at(rng.int(t.numbers.r1, t.numbers.r2), rng.int(t.numbers.c1, t.numbers.c2));
      return { state: stateOf(t.sheet, cell, ctx), params: { cell } };
    },
    check: (st, p) => isReady(st) && rawAt(st, p.cell) === "",
    optimal: () => ({ win: ["Delete"], mac: ["Delete"] }),
    requires: ["clear-contents"],
  }),
  defineTask<{ range: Range; n: number }>({
    id: "clear-range",
    category: "editing",
    difficulty: 1,
    prompt: (p) => `Clear ${R1(p.range)}`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const c = rng.int(t.numbers.c1, t.numbers.c2);
      const n = rng.int(2, 3);
      const r = rng.int(t.numbers.r1, t.numbers.r2 - n);
      return { state: stateOf(t.sheet, at(r, c), ctx), params: { range: rect(r, c, r + n, c), n } };
    },
    check: (st, p) => isReady(st) && everyCell(p.range, (a) => rawAt(st, a) === ""),
    optimal: (p) => ({ win: [...times(p.n, "shift+ArrowDown"), "Delete"], mac: [...times(p.n, "shift+ArrowDown"), "Delete"] }),
    requires: ["extend-down", "clear-contents"],
  }),
  defineTask<{ range: Range; n: number; top: CellAddr }>({
    id: "fill-down",
    category: "editing",
    difficulty: 2,
    prompt: (p) => `Fill the formula in ${A1(p.top)} down to ${A1({ r: p.range.r2, c: p.range.c1 })}`,
    setup(rng, ctx) {
      const n = rng.int(4, 7);
      const rows: (string | number)[][] = [["Units", "Price", "Revenue"]];
      for (let i = 0; i <= n; i++) rows.push([rng.int(10, 90), rng.int(5, 40), i === 0 ? "=A2*B2" : ""]);
      const sheet = fillFromRows(createSheet(), rows);
      const top = at(1, 2);
      return { state: stateOf(sheet, top, ctx), params: { top, n, range: rect(1, 2, 1 + n, 2) } };
    },
    check: (st, p) =>
      isReady(st) &&
      everyCell(p.range, (a) => rawAt(st, a).startsWith("=") && near(valueAt(st, a), Number(valueAt(st, at(a.r, 0))) * Number(valueAt(st, at(a.r, 1))))),
    optimal: (p) => ({ win: [...times(p.n, "shift+ArrowDown"), "ctrl+d"], mac: [...times(p.n, "shift+ArrowDown"), "ctrl+d"] }),
    requires: ["extend-down", "fill-down"],
  }),
  defineTask<{ range: Range; n: number; left: CellAddr }>({
    id: "fill-right",
    category: "editing",
    difficulty: 2,
    prompt: (p) => `Fill the formula in ${A1(p.left)} right to ${A1({ r: p.range.r1, c: p.range.c2 })}`,
    setup(rng, ctx) {
      const n = rng.int(2, 4);
      const years = Array.from({ length: n + 1 }, (_, i) => `FY${24 + i}`);
      const rows = [["", ...years], ["Revenue", ...years.map(() => rng.int(500, 2000))], ["x2", "=B2*2"]];
      const sheet = fillFromRows(createSheet(), rows);
      const left = at(2, 1);
      return { state: stateOf(sheet, left, ctx), params: { left, n, range: rect(2, 1, 2, 1 + n) } };
    },
    check: (st, p) => isReady(st) && everyCell(p.range, (a) => rawAt(st, a).startsWith("=") && near(valueAt(st, a), Number(valueAt(st, at(1, a.c))) * 2)),
    optimal: (p) => ({ win: [...times(p.n, "shift+ArrowRight"), "ctrl+r"], mac: [...times(p.n, "shift+ArrowRight"), "ctrl+r"] }),
    requires: ["extend-right", "fill-right"],
  }),
  defineTask<{ range: Range; n: number }>({
    id: "fill-selection",
    category: "editing",
    difficulty: 2,
    prompt: (p) => `Put 0 in every cell of ${R1(p.range)} in one go`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const c = t.range.c2 + 1;
      const n = rng.int(3, 5);
      const r = t.numbers.r1;
      return { state: stateOf(t.sheet, at(r, c), ctx), params: { range: rect(r, c, r + n, c), n } };
    },
    check: (st, p) => isReady(st) && everyCell(p.range, (a) => rawAt(st, a) === "0"),
    optimal: (p) => ({
      win: [...times(p.n, "shift+ArrowDown"), "type:0", "ctrl+Enter"],
      mac: [...times(p.n, "shift+ArrowDown"), "type:0", "meta+Enter"],
    }),
    requires: ["extend-down", "fill-selection"],
  }),
  defineTask<One>({
    id: "undo-delete",
    category: "editing",
    difficulty: 1,
    prompt: (p) => `Oops, ${A1(p.cell)} was cleared. Undo it`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const cell = at(rng.int(t.numbers.r1, t.numbers.r2), rng.int(t.numbers.c1, t.numbers.c2));
      const st = stateOf(t.sheet, cell, ctx);
      const was = cellOf(st, cell)!.raw;
      return { state: reduce(st, { type: "deleteKey" }), params: { cell, was } };
    },
    check: (st, p) => isReady(st) && rawAt(st, p.cell) === p.was,
    optimal: () => ({ win: ["ctrl+z"], mac: ["meta+z"] }),
    requires: ["undo"],
  }),
  defineTask<One>({
    id: "redo",
    category: "editing",
    difficulty: 2,
    prompt: (p) => `Redo the entry ${p.text} in ${A1(p.cell)} that was just undone`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const cell = at(t.range.r2 + 1, t.numbers.c1);
      const text = String(rng.int(100, 999));
      let st = stateOf(t.sheet, cell, ctx);
      st = reduce(reduce(st, { type: "input", text }), { type: "commitAll" });
      st = reduce(st, { type: "undo" });
      return { state: st, params: { cell, text } };
    },
    check: (st, p) => isReady(st) && rawAt(st, p.cell) === p.text,
    optimal: () => ({ win: ["ctrl+y"], mac: ["meta+shift+z"] }),
    requires: ["redo"],
  }),
  defineTask<One>({
    id: "copy-formula-above",
    category: "editing",
    difficulty: 2,
    prompt: (p) => `Copy the exact formula from the cell above into ${A1(p.cell)} (no shifting)`,
    setup(rng, ctx) {
      const n = rng.int(3, 6);
      const rows: (string | number)[][] = Array.from({ length: n }, () => [rng.int(10, 99)]);
      rows.push([`=SUM(A1:A${n})`]);
      const sheet = fillFromRows(createSheet(), rows);
      const cell = at(n + 1, 0);
      return { state: stateOf(sheet, cell, ctx), params: { cell, was: `=SUM(A1:A${n})` } };
    },
    check: (st, p) => isReady(st) && rawAt(st, p.cell) === p.was,
    optimal: () => ({ win: ["ctrl+'", "Enter"], mac: ["ctrl+'", "Enter"] }),
    requires: ["copy-from-above", "commit-down"],
  }),
  defineTask<One & { serial: number }>({
    id: "insert-today",
    category: "editing",
    difficulty: 1,
    prompt: (p) => `Enter today's date in ${A1(p.cell)}`,
    setup(rng, ctx) {
      const cell = at(rng.int(1, 6), rng.int(1, 4));
      const sheet = fillFromRows(createSheet(), [["Date:"]], at(cell.r, cell.c - 1));
      const [y, m, d] = ctx.today.split("-").map(Number) as [number, number, number];
      return { state: stateOf(sheet, cell, ctx), params: { cell, serial: dateToSerial(y, m, d) } };
    },
    check: (st, p) => isReady(st) && valueAt(st, p.cell) === p.serial,
    optimal: () => ({ win: ["ctrl+;", "Enter"], mac: ["ctrl+;", "Enter"] }),
    requires: ["insert-date", "commit-down"],
  }),
  defineTask<One>({
    id: "line-break",
    category: "editing",
    difficulty: 2,
    prompt: (p) => `In ${A1(p.cell)}, type “Net”, a line break, then “income”`,
    setup(rng, ctx) {
      const cell = at(rng.int(1, 8), rng.int(0, 3));
      return { state: stateOf(createSheet(), cell, ctx), params: { cell } };
    },
    check: (st, p) => isReady(st) && rawAt(st, p.cell) === "Net\nincome",
    optimal: () => ({ win: ["type:Net", "alt+Enter", "type:income", "Enter"], mac: ["type:Net", "alt+Enter", "type:income", "Enter"] }),
    requires: ["line-break"],
  }),
  defineTask<{ a: CellAddr; b: CellAddr }>({
    id: "repeat-bold",
    category: "editing",
    difficulty: 2,
    prompt: (p) => `Bold ${A1(p.a)}, then repeat the same action on ${A1(p.b)}`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const r = rng.int(t.numbers.r1, t.numbers.r2);
      const a = at(r, t.numbers.c1);
      return { state: stateOf(t.sheet, a, ctx), params: { a, b: at(r, t.numbers.c1 + 2) } };
    },
    check: (st, p) => isReady(st) && !!cellOf(st, p.a)?.format.bold && !!cellOf(st, p.b)?.format.bold,
    optimal: () => ({
      win: ["ctrl+b", "ArrowRight", "ArrowRight", "F4"],
      mac: ["meta+b", "ArrowRight", "ArrowRight", "meta+b"],
    }),
    requires: ["bold", "repeat"],
  }),
];
