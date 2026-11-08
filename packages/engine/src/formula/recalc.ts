import { cellKey, toA1 } from "../grid/address";
import type { Cell, CellValue, Sheet } from "../grid/types";
import { isError } from "../grid/types";
import { evaluate, type EvalContext } from "./evaluator";
import { parseFormula, type Ast } from "./parser";
import { FormulaSyntaxError } from "./tokenizer";

const AST_CACHE = new Map<string, Ast | "syntax">();

/** Parse "=…" text, cached by text. Returns "syntax" for an invalid formula. */
export function parseCached(raw: string): Ast | "syntax" {
  let hit = AST_CACHE.get(raw);
  if (hit) return hit;
  try {
    hit = parseFormula(raw.slice(1));
  } catch (e) {
    if (!(e instanceof FormulaSyntaxError)) throw e;
    hit = "syntax";
  }
  if (AST_CACHE.size > 5000) AST_CACHE.clear();
  AST_CACHE.set(raw, hit);
  return hit;
}

const sameValue = (a: CellValue, b: CellValue) =>
  a === b || (isError(a) && isError(b) && a.error === b.error) || (Number.isNaN(a) && Number.isNaN(b));

export interface RecalcResult {
  sheets: readonly Sheet[];
  /** Cells caught in a circular reference, as "Sheet1!B3". Their value is 0, as in Excel. */
  circular: string[];
}

/**
 * Full recalculation of every formula in the workbook. Sheets are tiny, so this runs on every
 * change. Unchanged cells and sheets keep their identity (cheap React re-renders, cheap undo).
 */
export function recalc(sheets: readonly Sheet[]): RecalcResult {
  const memo = new Map<string, CellValue>();
  const visiting = new Set<string>();
  const stack: string[] = [];
  const circular = new Set<string>();

  const isFormulaCell = (c: Cell | undefined) => !!c && c.raw.startsWith("=");

  const valueAt = (s: number, r: number, c: number): CellValue => {
    const sheet = sheets[s];
    if (!sheet) return { error: "#REF!" };
    const cell = sheet.cells[cellKey(r, c)];
    if (!isFormulaCell(cell)) return cell?.value ?? null;
    const key = `${s}:${r}:${c}`;
    const done = memo.get(key);
    if (done !== undefined) return done;
    if (visiting.has(key)) {
      // Every cell on the evaluation stack from the first visit of `key` is part of the loop.
      for (const k of stack.slice(stack.indexOf(key))) {
        const [ks, kr, kc] = k.split(":").map(Number) as [number, number, number];
        circular.add(`${sheets[ks]!.name}!${toA1({ r: kr, c: kc })}`);
      }
      return 0;
    }
    visiting.add(key);
    stack.push(key);
    const ast = parseCached(cell!.raw);
    const v: CellValue = ast === "syntax" ? { error: "#ERROR!" } : evaluate(ast, ctxFor(s));
    stack.pop();
    visiting.delete(key);
    memo.set(key, v);
    return v;
  };

  const ctxFor = (s: number): EvalContext => ({
    sheet: s,
    sheetIndex: (name) => {
      const i = sheets.findIndex((sh) => sh.name.toLowerCase() === name.toLowerCase());
      return i < 0 ? undefined : i;
    },
    bounds: (i) => ({ rows: sheets[i]?.rows ?? 0, cols: sheets[i]?.cols ?? 0 }),
    value: valueAt,
  });

  const out = sheets.map((sheet, s) => {
    let cells: Record<string, Cell> | null = null;
    for (const [k, cell] of Object.entries(sheet.cells)) {
      if (!isFormulaCell(cell)) continue;
      const [r, c] = k.split(":").map(Number) as [number, number];
      const v = valueAt(s, r, c);
      if (!sameValue(cell.value, v)) {
        cells ??= { ...sheet.cells };
        cells[k] = { ...cell, value: v };
      }
    }
    return cells ? { ...sheet, cells } : sheet;
  });

  // Cells in a cycle show 0 (Excel's behaviour) plus a warning in the UI.
  return { sheets: out, circular: [...circular].sort() };
}
