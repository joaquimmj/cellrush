/** #ERROR! = the formula text cannot be parsed (Excel refuses such an entry; we store and flag it). */
export type ErrorCode = "#REF!" | "#DIV/0!" | "#NAME?" | "#VALUE!" | "#CIRC!" | "#ERROR!";
export interface ErrorValue {
  error: ErrorCode;
}
export type CellValue = number | string | boolean | ErrorValue | null;

export type NumberFormat = "general" | "number" | "currency" | "percent" | "date";

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  numberFormat?: NumberFormat;
  decimals?: number;
  fontColor?: string;
  fillColor?: string;
  borders?: Borders;
  align?: "left" | "center" | "right";
}

export interface Borders {
  top?: boolean;
  right?: boolean;
  bottom?: boolean;
  left?: boolean;
}

/**
 * Simplified version of Excel's "Standard Colors" row (Alt, H, F, C / Alt, H, H): ← → to move,
 * Enter to apply. Index 0 is Automatic (no colour).
 */
export const PALETTE: ReadonlyArray<{ name: string; hex: string | undefined }> = [
  { name: "Automatic", hex: undefined },
  { name: "Dark Red", hex: "#C00000" },
  { name: "Red", hex: "#FF0000" },
  { name: "Orange", hex: "#FFC000" },
  { name: "Yellow", hex: "#FFFF00" },
  { name: "Light Green", hex: "#92D050" },
  { name: "Green", hex: "#00B050" },
  { name: "Light Blue", hex: "#00B0F0" },
  { name: "Blue", hex: "#0070C0" },
  { name: "Dark Blue", hex: "#002060" },
  { name: "Purple", hex: "#7030A0" },
];

export interface Cell {
  /** What the user typed: "42", "hello", "=A1*2". */
  raw: string;
  /** Computed value. Formulas stay null until the formula engine (M2) evaluates them. */
  value: CellValue;
  format: CellFormat;
}

export interface Sheet {
  name: string;
  rows: number;
  cols: number;
  cells: Readonly<Record<string, Cell>>;
  hiddenRows: readonly number[];
  hiddenCols: readonly number[];
  /** Column widths in px; missing = default. */
  colWidths: Readonly<Record<number, number>>;
}

export const DEFAULT_COL_WIDTH = 64;
export const isError = (v: CellValue): v is ErrorValue => typeof v === "object" && v !== null;
