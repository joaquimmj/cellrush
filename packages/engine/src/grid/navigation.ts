import { sameAddr, type CellAddr, type Range } from "./address";
import { getCell, isColHidden, isRowHidden } from "./sheet";
import type { Sheet } from "./types";
import { isEmptyCell } from "./value";

export type Dir = "up" | "down" | "left" | "right";
const DELTA: Record<Dir, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

const inBounds = (s: Sheet, a: CellAddr) => a.r >= 0 && a.c >= 0 && a.r < s.rows && a.c < s.cols;
const visible = (s: Sheet, a: CellAddr) => !isRowHidden(s, a.r) && !isColHidden(s, a.c);

/** One visible cell in `dir`, or `a` itself at the sheet edge. */
export function step(s: Sheet, a: CellAddr, dir: Dir): CellAddr {
  const [dr, dc] = DELTA[dir];
  let n = { r: a.r + dr, c: a.c + dc };
  while (inBounds(s, n) && !visible(s, n)) n = { r: n.r + dr, c: n.c + dc };
  return inBounds(s, n) ? n : a;
}

/** Move by `count` visible cells (PgUp/PgDn). */
export function stepN(s: Sheet, a: CellAddr, dir: Dir, count: number): CellAddr {
  let cur = a;
  for (let i = 0; i < count; i++) {
    const n = step(s, cur, dir);
    if (sameAddr(n, cur)) break;
    cur = n;
  }
  return cur;
}

export const isFilled = (s: Sheet, a: CellAddr): boolean => !isEmptyCell(getCell(s, a));

/**
 * Ctrl+Arrow (Cmd+Arrow on Mac): inside a block of data, go to its last cell;
 * otherwise go to the next filled cell, or to the sheet edge if there is none.
 */
export function jump(s: Sheet, a: CellAddr, dir: Dir): CellAddr {
  const first = step(s, a, dir);
  if (sameAddr(first, a)) return a;
  let cur = a;
  if (isFilled(s, a) && isFilled(s, first)) {
    for (;;) {
      const n = step(s, cur, dir);
      if (sameAddr(n, cur) || !isFilled(s, n)) return cur;
      cur = n;
    }
  }
  cur = first;
  for (;;) {
    if (isFilled(s, cur)) return cur;
    const n = step(s, cur, dir);
    if (sameAddr(n, cur)) return cur;
    cur = n;
  }
}

/** Ctrl+End: last used row × last used column (they can come from different cells, as in Excel). */
export function lastUsed(s: Sheet): CellAddr {
  let r = 0;
  let c = 0;
  for (const [k, cell] of Object.entries(s.cells)) {
    if (cell.raw === "") continue;
    const [row, col] = k.split(":").map(Number) as [number, number];
    if (row > r) r = row;
    if (col > c) c = col;
  }
  return { r, c };
}

/** Ctrl+A's "current region": the block of data around `a`, bounded by empty rows and columns. */
export function currentRegion(s: Sheet, a: CellAddr): Range {
  const box: Range = { r1: a.r, c1: a.c, r2: a.r, c2: a.c };
  const filledAt = (r: number, c: number) => r >= 0 && c >= 0 && r < s.rows && c < s.cols && isFilled(s, { r, c });
  const anyInRow = (r: number, c1: number, c2: number) => {
    for (let c = c1; c <= c2; c++) if (filledAt(r, c)) return true;
    return false;
  };
  const anyInCol = (c: number, r1: number, r2: number) => {
    for (let r = r1; r <= r2; r++) if (filledAt(r, c)) return true;
    return false;
  };
  let grew = true;
  while (grew) {
    grew = false;
    if (box.r1 > 0 && anyInRow(box.r1 - 1, box.c1 - 1, box.c2 + 1)) { box.r1--; grew = true; }
    if (box.r2 < s.rows - 1 && anyInRow(box.r2 + 1, box.c1 - 1, box.c2 + 1)) { box.r2++; grew = true; }
    if (box.c1 > 0 && anyInCol(box.c1 - 1, box.r1 - 1, box.r2 + 1)) { box.c1--; grew = true; }
    if (box.c2 < s.cols - 1 && anyInCol(box.c2 + 1, box.r1 - 1, box.r2 + 1)) { box.c2++; grew = true; }
  }
  return box;
}
