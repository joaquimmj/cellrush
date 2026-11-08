import { createSheet, dateToSerial, fillFromRows, type CellAddr, type NumberFormat, type Range } from "@cellrush/engine";
import { A1, R1, at, cellOf, company, everyCell, isReady, makeTable, rect, stateOf } from "../data";
import type { Rng } from "../rng";
import { defineTask, type SetupContext, type Task, type TaskInstance } from "../types";

type Fmt = { range: Range };

const toggle = (id: string, prop: "bold" | "italic" | "underline", win: string, mac: string): Task =>
  defineTask<{ cell: CellAddr }>({
    id,
    category: "formatting",
    difficulty: 1,
    prompt: (p) => `Make ${A1(p.cell)} ${prop}`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const cell = at(rng.int(t.numbers.r1, t.numbers.r2), rng.int(t.range.c1, t.range.c2));
      return { state: stateOf(t.sheet, cell, ctx), params: { cell } };
    },
    check: (st, p) => isReady(st) && !!cellOf(st, p.cell)?.format[prop],
    optimal: () => ({ win: [win], mac: [mac] }),
    requires: [prop],
  });

/** A column of numbers starting at the active cell, to be given a number format. */
function columnSetup(rng: Rng, ctx: SetupContext, kind: "decimal" | "money" | "date", preset?: NumberFormat): TaskInstance<Fmt> {
  const n = rng.int(4, 8);
  const c = rng.int(1, 4);
  const r0 = rng.int(1, 4);
  const value = () =>
    kind === "decimal" ? (rng.int(50, 950) / 1000).toString() : kind === "date" ? String(dateToSerial(2026, rng.int(1, 12), rng.int(1, 28))) : String(rng.int(1000, 99000) / 10);
  const rows = [[kind === "decimal" ? "Margin" : kind === "date" ? "Date" : "Amount"], ...Array.from({ length: n }, () => [value()])];
  let sheet = fillFromRows(createSheet(), rows, at(r0 - 1, c));
  if (preset) {
    const cells = { ...sheet.cells };
    for (const [k, cell] of Object.entries(cells)) if (typeof cell.value === "number") cells[k] = { ...cell, format: { numberFormat: preset } };
    sheet = { ...sheet, cells };
  }
  return { state: stateOf(sheet, at(r0, c), ctx), params: { range: rect(r0, c, r0 + n - 1, c) } };
}

const numberFormatTask = (id: string, label: string, fmt: NumberFormat, code: string, kind: "decimal" | "money" | "date", preset?: NumberFormat): Task =>
  defineTask<Fmt>({
    id,
    category: "formatting",
    difficulty: 1,
    prompt: (p) => `Format ${R1(p.range)} as ${label}`,
    setup: (rng, ctx) => columnSetup(rng, ctx, kind, preset),
    check: (st, p) => isReady(st) && everyCell(p.range, (a) => (cellOf(st, a)?.format.numberFormat ?? "general") === fmt),
    optimal: () => ({ win: ["ctrl+shift+ArrowDown", `ctrl+shift+${code}`], mac: ["meta+shift+ArrowDown", `ctrl+shift+${code}`] }),
    requires: ["jump-extend-down", `format-${fmt}`],
  });

export const formattingTasks: Task[] = [
  toggle("bold-cell", "bold", "ctrl+b", "meta+b"),
  toggle("italic-cell", "italic", "ctrl+i", "meta+i"),
  toggle("underline-cell", "underline", "ctrl+u", "meta+u"),
  defineTask<Fmt>({
    id: "bold-header-row",
    category: "formatting",
    difficulty: 1,
    prompt: (p) => `Bold the whole header row (row ${p.range.r1 + 1})`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      return { state: stateOf(t.sheet, t.origin, ctx), params: { range: rect(t.range.r1, t.range.c1, t.range.r1, t.range.c2) } };
    },
    check: (st, p) => isReady(st) && everyCell(p.range, (a) => !!cellOf(st, a)?.format.bold),
    optimal: () => ({ win: ["shift+Space", "ctrl+b"], mac: ["shift+Space", "meta+b"] }),
    requires: ["select-row", "bold"],
  }),
  numberFormatTask("format-percent", "a percentage", "percent", "Digit5", "decimal"),
  numberFormatTask("format-currency", "currency", "currency", "Digit4", "money"),
  numberFormatTask("format-number", "a number with 2 decimals", "number", "Digit1", "money"),
  numberFormatTask("format-date", "dates", "date", "Digit3", "date"),
  numberFormatTask("format-general", "General (remove the currency format)", "general", "Backquote", "money", "currency"),
  defineTask<{ cell: CellAddr }>({
    id: "add-decimal",
    category: "ribbon",
    difficulty: 2,
    prompt: (p) => `Show one more decimal in ${A1(p.cell)}`,
    setup(rng, ctx) {
      const cell = at(rng.int(1, 6), rng.int(1, 4));
      const sheet = fillFromRows(createSheet(), [[String(rng.int(10, 99) / 100)]], cell);
      const s = { ...sheet, cells: Object.fromEntries(Object.entries(sheet.cells).map(([k, c]) => [k, { ...c, format: { numberFormat: "percent" as const, decimals: 0 } }])) };
      return { state: stateOf(s, cell, ctx), params: { cell } };
    },
    check: (st, p) => isReady(st) && cellOf(st, p.cell)?.format.decimals === 1,
    optimal: () => ({ win: ["AltLeft", "h", "0"], mac: null }),
    requires: ["increase-decimal"],
  }),
  defineTask<{ cell: CellAddr }>({
    id: "remove-decimal",
    category: "ribbon",
    difficulty: 2,
    prompt: (p) => `Show one decimal less in ${A1(p.cell)}`,
    setup(rng, ctx) {
      const cell = at(rng.int(1, 6), rng.int(1, 4));
      const sheet = fillFromRows(createSheet(), [[String(rng.int(1000, 9999) / 100)]], cell);
      const s = { ...sheet, cells: Object.fromEntries(Object.entries(sheet.cells).map(([k, c]) => [k, { ...c, format: { numberFormat: "number" as const } }])) };
      return { state: stateOf(s, cell, ctx), params: { cell } };
    },
    check: (st, p) => isReady(st) && cellOf(st, p.cell)?.format.decimals === 1,
    optimal: () => ({ win: ["AltLeft", "h", "9"], mac: null }),
    requires: ["decrease-decimal"],
  }),
  defineTask<{ cell: CellAddr }>({
    id: "percent-one-decimal",
    category: "ribbon",
    difficulty: 3,
    prompt: (p) => `Format ${A1(p.cell)} as a percentage with 1 decimal`,
    setup(rng, ctx) {
      const cell = at(rng.int(1, 6), rng.int(1, 4));
      const sheet = fillFromRows(createSheet(), [["Margin", String(rng.int(100, 900) / 1000)]], at(cell.r, cell.c - 1));
      return { state: stateOf(sheet, cell, ctx), params: { cell } };
    },
    check: (st, p) => isReady(st) && cellOf(st, p.cell)?.format.numberFormat === "percent" && cellOf(st, p.cell)?.format.decimals === 1,
    optimal: () => ({ win: ["ctrl+shift+Digit5", "AltLeft", "h", "0"], mac: null }),
    requires: ["format-percent", "increase-decimal"],
  }),
  defineTask<{ cell: CellAddr }>({
    id: "autofit-column",
    category: "ribbon",
    difficulty: 2,
    prompt: (p) => `Autofit the width of column ${A1(p.cell).replace(/\d+/, "")} to its content`,
    setup(rng, ctx) {
      const cell = at(rng.int(1, 6), rng.int(0, 3));
      const sheet = fillFromRows(createSheet(), [[`${company(rng)} — ${company(rng)}`]], cell);
      return { state: stateOf(sheet, cell, ctx), params: { cell } };
    },
    check: (st, p) => isReady(st) && (st.sheets[st.sheetIndex]!.colWidths[p.cell.c] ?? 64) > 120,
    optimal: () => ({ win: ["AltLeft", "h", "o", "i"], mac: null }),
    requires: ["autofit-column"],
  }),
];
