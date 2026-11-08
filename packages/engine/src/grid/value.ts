import { dateToSerial } from "./display";
import type { Cell, CellFormat, CellValue } from "./types";

const NUMBER = /^\(?-?(?:\d{1,3}(?:,\d{3})+|\d*)(?:\.\d+)?\)?$/;
const DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** Parse what the user typed into a value (formulas are evaluated later, in M2). */
export function parseRaw(raw: string, dateStyle: "mdy" | "dmy" = "mdy"): { value: CellValue; format?: CellFormat } {
  const t = raw.trim();
  if (t === "") return { value: null };
  if (t.startsWith("=")) return { value: null };
  const date = DATE.exec(t);
  if (date) {
    const [a, b, y] = [Number(date[1]), Number(date[2]), Number(date[3])];
    const [m, d] = dateStyle === "mdy" ? [a, b] : [b, a];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { value: dateToSerial(y, m, d), format: { numberFormat: "date" } };
  }
  const upper = t.toUpperCase();
  if (upper === "TRUE") return { value: true };
  if (upper === "FALSE") return { value: false };
  const pct = /^(-?\d+(?:\.\d+)?)%$/.exec(t);
  if (pct) return { value: Number(pct[1]) / 100, format: { numberFormat: "percent" } };
  if (/\d/.test(t) && NUMBER.test(t)) {
    const paren = t.startsWith("(") && t.endsWith(")");
    if (paren || (!t.startsWith("(") && !t.endsWith(")"))) {
      const n = Number(t.replace(/[(),]/g, ""));
      if (!Number.isNaN(n)) return { value: paren ? -n : n };
    }
  }
  return { value: raw };
}

export const isFormula = (raw: string): boolean => raw.trim().startsWith("=");

/** Build a cell from typed text, keeping an existing format (and adopting an implied one such as "%"). */
export function makeCell(raw: string, prev?: Cell, dateStyle: "mdy" | "dmy" = "mdy"): Cell {
  const parsed = parseRaw(raw, dateStyle);
  const format = { ...(prev?.format ?? {}) };
  if (parsed.format?.numberFormat && (!format.numberFormat || format.numberFormat === "general")) {
    format.numberFormat = parsed.format.numberFormat;
  }
  return { raw, value: parsed.value, format };
}

export const isEmptyCell = (c: Cell | undefined): boolean => !c || c.raw === "";
export const hasFormat = (f: CellFormat): boolean => Object.values(f).some((v) => v !== undefined && v !== false);
