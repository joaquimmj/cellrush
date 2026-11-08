import type { ErrorCode } from "../grid/types";
import { FormulaSyntaxError, tokenize, type RefToken, type Token } from "./tokenizer";

export type Ast =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "err"; v: ErrorCode }
  | ({ k: "ref" } & RefToken)
  | { k: "range"; from: RefToken; to: RefToken }
  | { k: "neg"; arg: Ast }
  | { k: "pct"; arg: Ast }
  | { k: "bin"; op: string; l: Ast; r: Ast }
  | { k: "call"; name: string; args: Ast[] };

// Excel precedence, low → high: comparison, &, + -, * /, ^, unary minus, %, range (:).
// Note Excel binds unary minus tighter than ^, so =-2^2 is 4.
const INFIX: Record<string, number> = {
  "=": 10, "<>": 10, "<": 10, ">": 10, "<=": 10, ">=": 10,
  "&": 20, "+": 30, "-": 30, "*": 40, "/": 40, "^": 50,
};
const PREFIX_BP = 60;
const PERCENT_BP = 70;

/** Parse a formula body (text after "="). Throws FormulaSyntaxError. */
export function parseFormula(src: string): Ast {
  const toks = tokenize(src);
  let i = 0;
  const peek = (): Token | undefined => toks[i];
  const next = (): Token => {
    const t = toks[i++];
    if (!t) throw new FormulaSyntaxError("unexpected end of formula");
    return t;
  };

  function primary(): Ast {
    const t = next();
    switch (t.t) {
      case "num": return { k: "num", v: t.v };
      case "str": return { k: "str", v: t.v };
      case "bool": return { k: "bool", v: t.v };
      case "err": return { k: "err", v: t.v };
      case "ref": {
        const { start: _s, end: _e, t: _t, ...ref } = t;
        const colon = peek();
        if (colon?.t === "op" && colon.v === ":") {
          i++;
          const b = next();
          if (b.t !== "ref") throw new FormulaSyntaxError("expected a reference after ':'");
          const { start: _s2, end: _e2, t: _t2, ...to } = b;
          return { k: "range", from: ref, to: { ...to, sheet: to.sheet ?? ref.sheet } };
        }
        return { k: "ref", ...ref };
      }
      case "name": {
        if (peek()?.t !== "(") throw new FormulaSyntaxError(`unknown name ${t.v}`);
        i++;
        const args: Ast[] = [];
        if (peek()?.t === ")") { i++; return { k: "call", name: t.v, args }; }
        for (;;) {
          args.push(expr(0));
          const sep = next();
          if (sep.t === ")") break;
          if (sep.t !== ",") throw new FormulaSyntaxError("expected ',' or ')'");
        }
        return { k: "call", name: t.v, args };
      }
      case "(": {
        const e = expr(0);
        if (next().t !== ")") throw new FormulaSyntaxError("expected ')'");
        return e;
      }
      case "op":
        if (t.v === "-") return { k: "neg", arg: expr(PREFIX_BP) };
        if (t.v === "+") return expr(PREFIX_BP);
        throw new FormulaSyntaxError(`unexpected operator ${t.v}`);
      default:
        throw new FormulaSyntaxError(`unexpected ${t.t}`);
    }
  }

  function expr(minBp: number): Ast {
    let left = primary();
    for (;;) {
      const t = peek();
      if (!t || t.t !== "op") break;
      if (t.v === "%") {
        if (PERCENT_BP < minBp) break;
        i++;
        left = { k: "pct", arg: left };
        continue;
      }
      const bp = INFIX[t.v];
      if (bp === undefined || bp <= minBp) break;
      i++;
      // All Excel binary operators are left-associative (including ^).
      left = { k: "bin", op: t.v, l: left, r: expr(bp) };
    }
    return left;
  }

  const ast = expr(0);
  if (i < toks.length) throw new FormulaSyntaxError("unexpected trailing input");
  return ast;
}
