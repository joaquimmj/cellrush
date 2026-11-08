import { generalNumber } from "../formula/evaluator";
import type { Cell, NumberFormat } from "./types";
import { isError } from "./types";

export function defaultDecimals(fmt: NumberFormat | undefined, value: unknown): number {
  switch (fmt) {
    case "number":
    case "currency":
      return 2;
    case "percent":
    case "date":
      return 0;
    default:
      if (typeof value !== "number" || Number.isInteger(value)) return 0;
      return Math.min(10, (String(value).split(".")[1] ?? "").length);
  }
}

const group = (s: string) => {
  const [int, frac] = s.split(".");
  const g = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac !== undefined ? `${g}.${frac}` : g;
};

/** Excel serial date (1900 system) → m/d/yyyy (or dd/mm/yyyy). */
export function serialToDate(serial: number, style: "mdy" | "dmy" = "mdy"): string {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
  const [y, m, day] = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
  return style === "mdy" ? `${m}/${day}/${y}` : `${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** "2026-11-08" → text typed by Ctrl+; */
export function isoToDateText(iso: string, style: "mdy" | "dmy" = "mdy"): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return serialToDate(dateToSerial(y, m, d), style);
}

export function dateToSerial(y: number, m: number, d: number): number {
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

/**
 * General format in a cell: like Excel, round so the number fits the column instead of
 * widening it (0.6086956522 → 0.608696 in a default-width column). Big numbers go scientific.
 */
export function fitGeneral(n: number, maxChars = GENERAL_CHARS): string {
  const full = generalNumber(n);
  if (full.length <= maxChars) return full;
  const intLen = String(Math.trunc(Math.abs(n))).length + (n < 0 ? 1 : 0);
  if (intLen > maxChars) {
    const digits = Math.max(0, maxChars - 6 - (n < 0 ? 1 : 0)); // "d.ddE+nn"
    return n.toExponential(digits).replace("e", "E").replace(/E\+?(-?)(\d)$/, "E+$1" + "0$2").replace("E+-", "E-");
  }
  const decimals = Math.max(0, maxChars - intLen - 1);
  return String(Number(n.toFixed(decimals)));
}

/** Characters of a General number that fit a default-width column. */
export const GENERAL_CHARS = 8;

/** Text shown in the cell (`maxChars`: how many characters of a General number fit its column). */
export function displayText(cell: Cell | undefined, showFormulas = false, dateStyle: "mdy" | "dmy" = "mdy", maxChars = GENERAL_CHARS): string {
  if (!cell) return "";
  if (showFormulas && cell.raw.startsWith("=")) return cell.raw;
  const v = cell.value;
  if (v === null) return "";
  if (isError(v)) return v.error;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "string") return v;
  const fmt = cell.format.numberFormat ?? "general";
  const dec = cell.format.decimals ?? defaultDecimals(fmt, v);
  const abs = Math.abs(v);
  switch (fmt) {
    case "number":
      return `${v < 0 ? "-" : ""}${group(abs.toFixed(dec))}`;
    case "currency":
      return v < 0 ? `($${group(abs.toFixed(dec))})` : `$${group(abs.toFixed(dec))}`;
    case "percent":
      return `${(v * 100).toFixed(dec)}%`;
    case "date":
      return serialToDate(v, dateStyle);
    default:
      return cell.format.decimals !== undefined ? v.toFixed(dec) : fitGeneral(v, maxChars);
  }
}
