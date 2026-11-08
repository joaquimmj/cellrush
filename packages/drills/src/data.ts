import {
  createSheet, createState, fillFromRows, getCell, rangeToA1, sameAddr, selRange, toA1,
  type Cell, type CellAddr, type GridState, type Range, type Sheet,
} from "@cellrush/engine";
import type { Rng } from "./rng";
import type { SetupContext } from "./types";

// Everything here is synthetic: made-up names and numbers generated from the seed.
const PREFIX = ["North", "Blue", "Iron", "Silver", "Oak", "Bright", "Pine", "Swift", "Red", "Granite", "Harbor", "Summit"];
const SUFFIX = ["wind", "stone", "field", "bridge", "path", "line", "mark", "gate", "brook", "crest"];
const KIND = [" Labs", " Capital", " Systems", " Foods", " Energy", " Logistics", " Health", " Retail"];
const REGIONS = ["North", "South", "East", "West", "Central", "Nordics", "Iberia", "Benelux", "Alps", "Baltics", "Balkans", "Levant"];
const PERIODS = [["Q1", "Q2", "Q3", "Q4"], ["FY23", "FY24", "FY25", "FY26"], ["Jan", "Feb", "Mar", "Apr"]] as const;
const STATUS = ["Pending", "Open", "Draft", "Review"];

export const company = (rng: Rng) => `${rng.pick(PREFIX)}${rng.pick(SUFFIX)}${rng.pick(KIND)}`;
export const status = (rng: Rng) => rng.pick(STATUS);

export interface Table {
  sheet: Sheet;
  /** Header row, first column (the label header). */
  origin: CellAddr;
  /** Whole table including header row and label column. */
  range: Range;
  /** Numbers only (no header, no labels). */
  numbers: Range;
}

export interface TableOptions {
  rows?: [number, number];
  cols?: number;
  origin?: CellAddr;
  sheet?: Sheet;
  name?: string;
}

/** A labelled numeric table, e.g. Region × Q1..Q4. */
export function makeTable(rng: Rng, o: TableOptions = {}): Table {
  const nRows = rng.int(...(o.rows ?? [5, 9]));
  const nCols = o.cols ?? 4;
  const origin = o.origin ?? { r: rng.int(1, 3), c: rng.int(0, 2) };
  const periods = rng.pick(PERIODS);
  const header = [rng.pick(["Region", "Segment", "Market"]), ...Array.from({ length: nCols }, (_, i) => periods[i % periods.length]!)];
  const labels = rng.shuffle(REGIONS).slice(0, nRows);
  const rows: (string | number)[][] = [header, ...labels.map((l) => [l, ...Array.from({ length: nCols }, () => rng.int(80, 990))])];
  const sheet = fillFromRows(o.sheet ?? createSheet(o.name ?? "Sheet1"), rows, origin);
  return {
    sheet,
    origin,
    range: { r1: origin.r, c1: origin.c, r2: origin.r + nRows, c2: origin.c + nCols },
    numbers: { r1: origin.r + 1, c1: origin.c + 1, r2: origin.r + nRows, c2: origin.c + nCols },
  };
}

export function stateOf(sheets: Sheet[] | Sheet, active: CellAddr, ctx: SetupContext): GridState {
  return createState({ sheets: Array.isArray(sheets) ? sheets : [sheets], active, options: { today: ctx.today } });
}

// ── check helpers ──

export const isReady = (st: GridState) => st.mode === "ready" && !st.dialog && st.keytip === null;
export const activeIs = (st: GridState, a: CellAddr) => sameAddr(st.sel.active, a);
export const selectionIs = (st: GridState, r: Range) => {
  const s = selRange(st.sel);
  return s.r1 === r.r1 && s.c1 === r.c1 && s.r2 === r.r2 && s.c2 === r.c2;
};
/** Single cell selected and active at `a`. */
export const cursorAt = (st: GridState, a: CellAddr) => activeIs(st, a) && selectionIs(st, { r1: a.r, c1: a.c, r2: a.r, c2: a.c });
export const cellOf = (st: GridState, a: CellAddr): Cell | undefined => getCell(st.sheets[st.sheetIndex]!, a);
export const rawAt = (st: GridState, a: CellAddr) => cellOf(st, a)?.raw ?? "";
export const valueAt = (st: GridState, a: CellAddr) => cellOf(st, a)?.value ?? null;
export function everyCell(r: Range, fn: (a: CellAddr) => boolean): boolean {
  for (let row = r.r1; row <= r.r2; row++) for (let col = r.c1; col <= r.c2; col++) if (!fn({ r: row, c: col })) return false;
  return true;
}
export const near = (a: unknown, b: number) => typeof a === "number" && Math.abs(a - b) < 1e-9;

export const A1 = toA1;
export const R1 = rangeToA1;
export const at = (r: number, c: number): CellAddr => ({ r, c });
export const rect = (r1: number, c1: number, r2: number, c2: number): Range => ({ r1, c1, r2, c2 });
export const colRange = (c: number, rows = 60): Range => ({ r1: 0, c1: c, r2: rows - 1, c2: c });
export const rowRange = (r: number, cols = 26): Range => ({ r1: r, c1: 0, r2: r, c2: cols - 1 });

/** Repeat a stroke n times. */
export const times = (n: number, s: string) => Array.from({ length: n }, () => s);
