export interface CellAddr {
  r: number; // 0-based row
  c: number; // 0-based column
}

/** Inclusive, normalized rectangle (r1 <= r2, c1 <= c2). */
export interface Range {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export const addr = (r: number, c: number): CellAddr => ({ r, c });
export const cellKey = (r: number, c: number): string => `${r}:${c}`;
export const sameAddr = (a: CellAddr, b: CellAddr): boolean => a.r === b.r && a.c === b.c;

export function colToLetters(c: number): string {
  let n = c + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function lettersToCol(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export const toA1 = (a: CellAddr): string => `${colToLetters(a.c)}${a.r + 1}`;

export function parseA1(ref: string): CellAddr {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(ref.trim());
  if (!m) throw new Error(`bad A1 reference: ${ref}`);
  return { r: Number(m[2]) - 1, c: lettersToCol(m[1]!) };
}

export function rangeOf(a: CellAddr, b: CellAddr): Range {
  return { r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) };
}

export function parseRange(ref: string): Range {
  const [a, b] = ref.split(":");
  const start = parseA1(a!);
  return rangeOf(start, b ? parseA1(b) : start);
}

export function rangeToA1(r: Range): string {
  const a = toA1({ r: r.r1, c: r.c1 });
  return r.r1 === r.r2 && r.c1 === r.c2 ? a : `${a}:${toA1({ r: r.r2, c: r.c2 })}`;
}

export const inRange = (r: Range, a: CellAddr): boolean => a.r >= r.r1 && a.r <= r.r2 && a.c >= r.c1 && a.c <= r.c2;
export const rangeSize = (r: Range): number => (r.r2 - r.r1 + 1) * (r.c2 - r.c1 + 1);
export const sameRange = (a: Range, b: Range): boolean => a.r1 === b.r1 && a.c1 === b.c1 && a.r2 === b.r2 && a.c2 === b.c2;

export function* cellsIn(r: Range): Generator<CellAddr> {
  for (let row = r.r1; row <= r.r2; row++) for (let col = r.c1; col <= r.c2; col++) yield { r: row, c: col };
}
