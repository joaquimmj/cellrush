import { structuralRewrite, type Axis } from "../formula/refs";
import type { RefToken } from "../formula/tokenizer";
import { cellKey } from "./address";
import type { Cell, Sheet } from "./types";

/**
 * Insert (count > 0) or delete (count < 0) whole rows/columns at `at` on sheet `target`.
 * Moves cells, hidden flags and widths on that sheet, and fixes formulas on every sheet
 * that point at it. Cells pushed past the sheet edge are dropped.
 */
export function insertLines(sheets: readonly Sheet[], target: number, axis: Axis, at: number, count: number): Sheet[] {
  const tSheet = sheets[target]!;
  const limit = axis === "row" ? tSheet.rows : tSheet.cols;
  const del = count < 0 ? -count : 0;
  const move = (v: number): number | null => {
    if (v < at) return v;
    if (count > 0) return v + count < limit ? v + count : null;
    if (v < at + del) return null;
    return v - del;
  };
  const targetName = tSheet.name.toLowerCase();

  return sheets.map((sheet, s) => {
    const pointsAtTarget = (ref: RefToken) =>
      ref.sheet === undefined ? s === target : ref.sheet.toLowerCase() === targetName;
    const cells: Record<string, Cell> = {};
    for (const [k, cell] of Object.entries(sheet.cells)) {
      let [r, c] = k.split(":").map(Number) as [number, number];
      if (s === target) {
        const v = move(axis === "row" ? r : c);
        if (v === null) continue;
        if (axis === "row") r = v;
        else c = v;
      }
      const raw = cell.raw.startsWith("=") ? structuralRewrite(cell.raw, axis, at, count, limit, pointsAtTarget) : cell.raw;
      cells[cellKey(r, c)] = raw === cell.raw ? cell : { ...cell, raw };
    }
    if (s !== target) return { ...sheet, cells };
    const shiftList = (xs: readonly number[]) => xs.map(move).filter((v): v is number => v !== null);
    const widths: Record<number, number> = {};
    if (axis === "col") {
      for (const [c, w] of Object.entries(sheet.colWidths)) {
        const v = move(Number(c));
        if (v !== null) widths[v] = w;
      }
    }
    return {
      ...sheet,
      cells,
      hiddenRows: axis === "row" ? shiftList(sheet.hiddenRows) : sheet.hiddenRows,
      hiddenCols: axis === "col" ? shiftList(sheet.hiddenCols) : sheet.hiddenCols,
      colWidths: axis === "col" ? widths : sheet.colWidths,
    };
  });
}
