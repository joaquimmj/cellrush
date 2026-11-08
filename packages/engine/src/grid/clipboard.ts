import { shiftFormula } from "../formula/refs";
import { cellsIn, type CellAddr, type Range } from "./address";
import { getCell, setCells } from "./sheet";
import type { Clipboard, PasteMode } from "./state";
import type { Cell, CellValue, Sheet } from "./types";
import { isError } from "./types";
import { hasFormat } from "./value";

export function snapshot(sheet: Sheet, sheetIndex: number, range: Range, cut: boolean): Clipboard {
  const cells: Record<string, Cell> = {};
  for (const a of cellsIn(range)) {
    const cell = getCell(sheet, a);
    if (cell) cells[`${a.r - range.r1}:${a.c - range.c1}`] = cell;
  }
  return { sheetIndex, range, cut, cells };
}

/** Copy of a cell moved by (dr, dc): relative references in formulas follow, as in Excel. */
export function copyCellTo(cell: Cell | undefined, dr: number, dc: number, bounds: { rows: number; cols: number }): Cell | undefined {
  if (!cell) return undefined;
  const raw = cell.raw.startsWith("=") ? shiftFormula(cell.raw, dr, dc, bounds) : cell.raw;
  return { ...cell, raw, format: { ...cell.format } };
}

function rawOfValue(v: CellValue): string {
  if (v === null) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (isError(v)) return v.error;
  return String(v);
}

function pasteOne(src: Cell | undefined, prev: Cell | undefined, mode: PasteMode, dr: number, dc: number, sheet: Sheet, cut: boolean): Cell | undefined {
  const bounds = { rows: sheet.rows, cols: sheet.cols };
  switch (mode) {
    case "all":
      // Cut keeps formulas exactly as written; copy shifts relative references.
      return cut ? (src ? { ...src } : undefined) : copyCellTo(src, dr, dc, bounds);
    case "values": {
      const format = prev?.format ?? {};
      if (!src || src.value === null) return hasFormat(format) ? { raw: "", value: null, format } : undefined;
      return { raw: rawOfValue(src.value), value: src.value, format };
    }
    case "formulas": {
      const format = prev?.format ?? {};
      const moved = copyCellTo(src, dr, dc, bounds);
      if (!moved) return hasFormat(format) ? { raw: "", value: null, format } : undefined;
      return { ...moved, format };
    }
    case "formats": {
      const format = { ...(src?.format ?? {}) };
      return prev ? { ...prev, format } : hasFormat(format) ? { raw: "", value: null, format } : undefined;
    }
  }
}

/**
 * Paste the clipboard at `dest` (selected range). If the destination is a whole multiple of the
 * copied block (e.g. one cell copied, a column selected), the block is tiled, as in Excel.
 * Returns the new sheet and the pasted range.
 */
export function paste(sheet: Sheet, clip: Clipboard, dest: Range, mode: PasteMode, sameSheet: boolean): { sheet: Sheet; range: Range } {
  const h = clip.range.r2 - clip.range.r1 + 1;
  const w = clip.range.c2 - clip.range.c1 + 1;
  const dh = dest.r2 - dest.r1 + 1;
  const dw = dest.c2 - dest.c1 + 1;
  const tile = !clip.cut && dh % h === 0 && dw % w === 0;
  const rows = tile ? dh : h;
  const cols = tile ? dw : w;
  const out: Range = { r1: dest.r1, c1: dest.c1, r2: Math.min(sheet.rows - 1, dest.r1 + rows - 1), c2: Math.min(sheet.cols - 1, dest.c1 + cols - 1) };

  const writes: [CellAddr, Cell | undefined][] = [];
  if (clip.cut && sameSheet) {
    // Clear the source first; the paste below may overwrite part of it.
    for (const a of cellsIn(clip.range)) writes.push([a, undefined]);
  }
  for (const a of cellsIn(out)) {
    const dr0 = (a.r - out.r1) % h;
    const dc0 = (a.c - out.c1) % w;
    const src = clip.cells[`${dr0}:${dc0}`];
    const srcAddr = { r: clip.range.r1 + dr0, c: clip.range.c1 + dc0 };
    writes.push([a, pasteOne(src, getCell(sheet, a), mode, a.r - srcAddr.r, a.c - srcAddr.c, sheet, clip.cut)]);
  }
  return { sheet: setCells(sheet, writes), range: out };
}
