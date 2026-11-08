import { lettersToCol } from "../grid/address";
import type { ErrorCode } from "../grid/types";

/** A cell reference as written: column/row are 0-based, `abs*` mark the `$`. */
export interface RefToken {
  /** Sheet name as written (unquoted), or undefined for the current sheet. */
  sheet?: string;
  /** Prefix exactly as written, e.g. "Sheet2!" or "'My Sheet'!" — kept when rewriting. */
  prefix: string;
  r: number;
  c: number;
  absR: boolean;
  absC: boolean;
}

export type Token =
  | { t: "num"; v: number; start: number; end: number }
  | { t: "str"; v: string; start: number; end: number }
  | { t: "bool"; v: boolean; start: number; end: number }
  | { t: "err"; v: ErrorCode; start: number; end: number }
  | ({ t: "ref"; start: number; end: number } & RefToken)
  | { t: "name"; v: string; start: number; end: number }
  | { t: "op"; v: string; start: number; end: number }
  | { t: "("; start: number; end: number }
  | { t: ")"; start: number; end: number }
  | { t: ","; start: number; end: number };

export class FormulaSyntaxError extends Error {}

const REF = /^((?:'(?:[^']|'')+'|[A-Za-z_][\w.]*)!)?(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![\w(!])/;
const NUM = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
const NAME = /^[A-Za-z_][\w.]*/;
const ERR = /^#(?:REF!|DIV\/0!|NAME\?|VALUE!|CIRC!|ERROR!)/;
const OPS = ["<=", ">=", "<>", "+", "-", "*", "/", "^", "&", "=", "<", ">", "%", ":"];

/** Tokenize a formula body (without the leading "="). Positions are relative to `src`. */
export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) { i++; continue; }
    const rest = src.slice(i);
    if (ch === '"') {
      let j = i + 1;
      let v = "";
      for (;;) {
        if (j >= src.length) throw new FormulaSyntaxError("unterminated string");
        if (src[j] === '"') {
          if (src[j + 1] === '"') { v += '"'; j += 2; continue; }
          break;
        }
        v += src[j++];
      }
      out.push({ t: "str", v, start: i, end: j + 1 });
      i = j + 1;
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = ERR.exec(rest))) {
      out.push({ t: "err", v: m[0] as ErrorCode, start: i, end: i + m[0].length });
      i += m[0].length;
      continue;
    }
    if ((m = REF.exec(rest)) && Number(m[5]) >= 1) {
      const prefix = m[1] ?? "";
      const sheet = prefix ? prefix.slice(0, -1).replace(/^'(.*)'$/, "$1").replace(/''/g, "'") : undefined;
      out.push({
        t: "ref", prefix, sheet, absC: m[2] === "$", c: lettersToCol(m[3]!), absR: m[4] === "$", r: Number(m[5]) - 1,
        start: i, end: i + m[0].length,
      });
      i += m[0].length;
      continue;
    }
    if ((m = NUM.exec(rest))) {
      out.push({ t: "num", v: Number(m[0]), start: i, end: i + m[0].length });
      i += m[0].length;
      continue;
    }
    if ((m = NAME.exec(rest))) {
      const up = m[0].toUpperCase();
      if ((up === "TRUE" || up === "FALSE") && src[i + m[0].length] !== "(") {
        out.push({ t: "bool", v: up === "TRUE", start: i, end: i + m[0].length });
      } else {
        out.push({ t: "name", v: up, start: i, end: i + m[0].length });
      }
      i += m[0].length;
      continue;
    }
    if (ch === "(" || ch === ")" || ch === ",") {
      out.push({ t: ch, start: i, end: i + 1 });
      i++;
      continue;
    }
    const op = OPS.find((o) => rest.startsWith(o));
    if (op) {
      out.push({ t: "op", v: op, start: i, end: i + op.length });
      i += op.length;
      continue;
    }
    throw new FormulaSyntaxError(`unexpected "${ch}"`);
  }
  return out;
}
