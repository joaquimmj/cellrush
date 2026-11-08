import { cellKey, type CellAddr } from "./address";
import type { Cell, Sheet } from "./types";
import { makeCell } from "./value";

export function createSheet(name = "Sheet1", rows = 60, cols = 26): Sheet {
  return { name, rows, cols, cells: {}, hiddenRows: [], hiddenCols: [], colWidths: {} };
}

export const getCell = (s: Sheet, a: CellAddr): Cell | undefined => s.cells[cellKey(a.r, a.c)];

/** Apply several cell writes at once (undefined removes the cell). Returns a new sheet; the old one is untouched. */
export function setCells(s: Sheet, writes: Iterable<[CellAddr, Cell | undefined]>): Sheet {
  const cells: Record<string, Cell> = { ...s.cells };
  for (const [a, cell] of writes) {
    const k = cellKey(a.r, a.c);
    if (cell === undefined) Reflect.deleteProperty(cells, k);
    else cells[k] = cell;
  }
  return { ...s, cells };
}

/** Seed a sheet from a 2-D array of typed text, starting at `origin` (default A1). Used by drills and tests. */
export function fillFromRows(
  s: Sheet,
  rows: ReadonlyArray<ReadonlyArray<string | number | null>>,
  origin: CellAddr = { r: 0, c: 0 },
): Sheet {
  const writes: [CellAddr, Cell | undefined][] = [];
  rows.forEach((row, dr) =>
    row.forEach((v, dc) => {
      if (v === null || v === "") return;
      writes.push([{ r: origin.r + dr, c: origin.c + dc }, makeCell(String(v))]);
    }),
  );
  return setCells(s, writes);
}

export const isRowHidden = (s: Sheet, r: number) => s.hiddenRows.includes(r);
export const isColHidden = (s: Sheet, c: number) => s.hiddenCols.includes(c);
