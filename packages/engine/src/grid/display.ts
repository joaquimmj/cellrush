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

/** Text shown in the cell. */
export function displayText(cell: Cell | undefined, showFormulas = false, dateStyle: "mdy" | "dmy" = "mdy"): string {
  if (!cell) return "";
  if (showFormulas && cell.raw.startsWith("=")) return cell.raw;
  const v = cell.value;
  if (v === null) return cell.raw.startsWith("=") ? cell.raw : "";
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
      return cell.format.decimals !== undefined ? v.toFixed(dec) : String(v);
  }
}
