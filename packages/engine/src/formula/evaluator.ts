import type { CellValue, ErrorCode, ErrorValue } from "../grid/types";
import { isError } from "../grid/types";
import type { Ast } from "./parser";
import type { RefToken } from "./tokenizer";

export interface EvalContext {
  /** Index of the sheet the formula lives on. */
  sheet: number;
  /** Resolve a sheet name (case-insensitive) to its index. */
  sheetIndex(name: string): number | undefined;
  /** Bounds of a sheet, to reject references past its edge. */
  bounds(sheet: number): { rows: number; cols: number };
  /** Value of a cell (evaluating it first if it holds a formula). Empty = null. */
  value(sheet: number, r: number, c: number): CellValue;
}

type RangeVal = { range: CellValue[] };
type Val = CellValue | RangeVal;

const err = (e: ErrorCode): ErrorValue => ({ error: e });
const isRange = (v: Val): v is RangeVal => typeof v === "object" && v !== null && "range" in v;

/** Format a number like Excel's General format (up to 10 significant digits, no float noise). */
export function generalNumber(n: number): string {
  if (!Number.isFinite(n)) return "#NUM!";
  if (n === 0) return "0";
  const s = String(Number(n.toPrecision(10)));
  return s.includes("e") ? n.toExponential(5).replace(/\.?0+e/, "E").replace("e", "E") : s;
}

export function valueToText(v: CellValue): string {
  if (v === null) return "";
  if (typeof v === "number") return generalNumber(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (isError(v)) return v.error;
  return v;
}

function toNumber(v: CellValue): number | ErrorValue {
  if (v === null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (isError(v)) return v;
  const t = v.trim();
  if (t !== "" && !Number.isNaN(Number(t))) return Number(t);
  return err("#VALUE!");
}

function sheetOf(ref: RefToken, ctx: EvalContext): number | ErrorValue {
  if (ref.sheet === undefined) return ctx.sheet;
  return ctx.sheetIndex(ref.sheet) ?? err("#REF!");
}

function inBounds(ctx: EvalContext, s: number, r: number, c: number) {
  const b = ctx.bounds(s);
  return r >= 0 && c >= 0 && r < b.rows && c < b.cols;
}

/** Evaluate to a single value (a bare range in a scalar slot is #VALUE!, no spilling). */
function scalar(v: Val): CellValue {
  return isRange(v) ? err("#VALUE!") : v;
}

function compare(a: CellValue, b: CellValue): number {
  // Excel ordering: numbers < text < booleans; empty acts as 0 or "" depending on the other side.
  const rank = (v: CellValue) => (typeof v === "number" ? 0 : typeof v === "string" ? 1 : 2);
  if (a === null) a = typeof b === "string" ? "" : typeof b === "boolean" ? false : 0;
  if (b === null) b = typeof a === "string" ? "" : typeof a === "boolean" ? false : 0;
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (typeof a === "string") {
    const x = a.toLowerCase();
    const y = (b as string).toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  const x = Number(a);
  const y = Number(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

function binary(op: string, a: CellValue, b: CellValue): CellValue {
  if (isError(a)) return a;
  if (isError(b)) return b;
  if (op === "&") return valueToText(a) + valueToText(b);
  if (["=", "<>", "<", ">", "<=", ">="].includes(op)) {
    const c = compare(a, b);
    switch (op) {
      case "=": return c === 0;
      case "<>": return c !== 0;
      case "<": return c < 0;
      case ">": return c > 0;
      case "<=": return c <= 0;
      default: return c >= 0;
    }
  }
  const x = toNumber(a);
  const y = toNumber(b);
  if (typeof x !== "number") return x;
  if (typeof y !== "number") return y;
  switch (op) {
    case "+": return x + y;
    case "-": return x - y;
    case "*": return x * y;
    case "/": return y === 0 ? err("#DIV/0!") : x / y;
    case "^": {
      const p = Math.pow(x, y);
      return Number.isFinite(p) ? p : err("#VALUE!");
    }
  }
  return err("#VALUE!");
}

/** Numbers to aggregate. Ranges skip text/booleans/empties; direct arguments are coerced. */
function collectNumbers(args: Ast[], ctx: EvalContext): number[] | ErrorValue {
  const nums: number[] = [];
  for (const a of args) {
    const v = evalNode(a, ctx);
    if (isRange(v)) {
      for (const x of v.range) {
        if (isError(x)) return x;
        if (typeof x === "number") nums.push(x);
      }
      continue;
    }
    if (v === null) continue;
    const n = toNumber(v);
    if (typeof n !== "number") return n;
    nums.push(n);
  }
  return nums;
}

function roundHalfAway(x: number, digits: number): number {
  const f = Math.pow(10, digits);
  const y = Math.abs(x) * f;
  // Nudge by epsilon so 2.675 rounds like Excel (decimal intent), not like binary float.
  const r = Math.round(y + 1e-9 * Math.max(1, y)) / f;
  return x < 0 ? -r : r;
}

function truthy(v: CellValue): boolean | ErrorValue {
  if (isError(v)) return v;
  if (typeof v === "boolean") return v;
  if (v === null) return false;
  if (typeof v === "number") return v !== 0;
  const up = v.toUpperCase();
  if (up === "TRUE") return true;
  if (up === "FALSE") return false;
  return err("#VALUE!");
}

type Fn = (args: Ast[], ctx: EvalContext) => CellValue;

const arity = (min: number, max: number, fn: Fn): Fn => (args, ctx) =>
  args.length < min || args.length > max ? err("#VALUE!") : fn(args, ctx);

export const FUNCTIONS: Record<string, Fn> = {
  SUM: arity(1, 255, (args, ctx) => {
    const n = collectNumbers(args, ctx);
    return Array.isArray(n) ? n.reduce((s, x) => s + x, 0) : n;
  }),
  AVERAGE: arity(1, 255, (args, ctx) => {
    const n = collectNumbers(args, ctx);
    if (!Array.isArray(n)) return n;
    return n.length ? n.reduce((s, x) => s + x, 0) / n.length : err("#DIV/0!");
  }),
  MIN: arity(1, 255, (args, ctx) => {
    const n = collectNumbers(args, ctx);
    return Array.isArray(n) ? (n.length ? Math.min(...n) : 0) : n;
  }),
  MAX: arity(1, 255, (args, ctx) => {
    const n = collectNumbers(args, ctx);
    return Array.isArray(n) ? (n.length ? Math.max(...n) : 0) : n;
  }),
  COUNT: arity(1, 255, (args, ctx) => {
    let count = 0;
    for (const a of args) {
      const v = evalNode(a, ctx);
      if (isRange(v)) count += v.range.filter((x) => typeof x === "number").length;
      else if (typeof v === "number") count++;
      else if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) count++;
      else if (typeof v === "boolean") count++;
    }
    return count;
  }),
  ROUND: arity(2, 2, (args, ctx) => {
    const x = toNumber(scalar(evalNode(args[0]!, ctx)));
    const d = toNumber(scalar(evalNode(args[1]!, ctx)));
    if (typeof x !== "number") return x;
    if (typeof d !== "number") return d;
    return roundHalfAway(x, Math.trunc(d));
  }),
  ABS: arity(1, 1, (args, ctx) => {
    const x = toNumber(scalar(evalNode(args[0]!, ctx)));
    return typeof x === "number" ? Math.abs(x) : x;
  }),
  IF: arity(2, 3, (args, ctx) => {
    const c = truthy(scalar(evalNode(args[0]!, ctx)));
    if (typeof c !== "boolean") return c;
    if (c) return scalar(evalNode(args[1]!, ctx));
    return args[2] ? scalar(evalNode(args[2], ctx)) : false;
  }),
  IFERROR: arity(2, 2, (args, ctx) => {
    const v = scalar(evalNode(args[0]!, ctx));
    return isError(v) ? scalar(evalNode(args[1]!, ctx)) : v;
  }),
};

function evalNode(node: Ast, ctx: EvalContext): Val {
  switch (node.k) {
    case "num":
    case "str":
    case "bool":
      return node.v;
    case "err":
      return err(node.v);
    case "ref": {
      const s = sheetOf(node, ctx);
      if (typeof s !== "number") return s;
      if (!inBounds(ctx, s, node.r, node.c)) return err("#REF!");
      return ctx.value(s, node.r, node.c);
    }
    case "range": {
      const s = sheetOf(node.from, ctx);
      if (typeof s !== "number") return s;
      const r1 = Math.min(node.from.r, node.to.r);
      const r2 = Math.max(node.from.r, node.to.r);
      const c1 = Math.min(node.from.c, node.to.c);
      const c2 = Math.max(node.from.c, node.to.c);
      if (!inBounds(ctx, s, r1, c1) || !inBounds(ctx, s, r2, c2)) return err("#REF!");
      const range: CellValue[] = [];
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) range.push(ctx.value(s, r, c));
      return { range };
    }
    case "neg": {
      const x = toNumber(scalar(evalNode(node.arg, ctx)));
      return typeof x === "number" ? -x : x;
    }
    case "pct": {
      const x = toNumber(scalar(evalNode(node.arg, ctx)));
      return typeof x === "number" ? x / 100 : x;
    }
    case "bin":
      return binary(node.op, scalar(evalNode(node.l, ctx)), scalar(evalNode(node.r, ctx)));
    case "call": {
      const fn = FUNCTIONS[node.name];
      return fn ? fn(node.args, ctx) : err("#NAME?");
    }
  }
}

/** Evaluate a parsed formula to the value stored in its cell. */
export function evaluate(ast: Ast, ctx: EvalContext): CellValue {
  const v = scalar(evalNode(ast, ctx));
  // =A1 where A1 is empty displays 0.
  return v === null ? 0 : v;
}
