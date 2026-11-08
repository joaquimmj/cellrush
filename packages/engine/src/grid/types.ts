export type ErrorCode = "#REF!" | "#DIV/0!" | "#NAME?" | "#VALUE!" | "#CIRC!";
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
  align?: "left" | "center" | "right";
}

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
