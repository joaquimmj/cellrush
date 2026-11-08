import { colToLetters } from "../grid/address";
import { tokenize, type RefToken, type Token } from "./tokenizer";

type RefTok = Extract<Token, { t: "ref" }>;

export function refText(ref: RefToken): string {
  return `${ref.prefix}${ref.absC ? "$" : ""}${colToLetters(ref.c)}${ref.absR ? "$" : ""}${ref.r + 1}`;
}

export interface RefRewriter {
  /** New ref, or null for #REF!. */
  ref(ref: RefToken): RefToken | null;
  /** New [from, to] for a range, or null for #REF!. Defaults to applying `ref` to both ends. */
  range?(from: RefToken, to: RefToken): [RefToken, RefToken] | null;
}

/**
 * Rewrite every reference in a formula ("=..." text), keeping everything else exactly as typed.
 * Unparseable text is returned unchanged.
 */
export function rewriteRefs(raw: string, rw: RefRewriter): string {
  if (!raw.startsWith("=")) return raw;
  let toks: Token[];
  try {
    toks = tokenize(raw.slice(1));
  } catch {
    return raw;
  }
  const body = raw.slice(1);
  let out = "";
  let pos = 0;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    if (t.t !== "ref") continue;
    const colon = toks[i + 1];
    const end = toks[i + 2];
    const isRange = colon?.t === "op" && colon.v === ":" && end?.t === "ref";
    out += body.slice(pos, t.start);
    if (isRange) {
      const to = end as RefTok;
      const toRef: RefToken = { ...to, sheet: to.sheet ?? t.sheet };
      const res = rw.range
        ? rw.range(t, toRef)
        : (() => {
            const a = rw.ref(t);
            const b = rw.ref(toRef);
            return a && b ? ([a, b] as [RefToken, RefToken]) : null;
          })();
      out += res ? `${refText(res[0])}${body.slice(t.end, to.start)}${refText({ ...res[1], prefix: to.prefix })}` : "#REF!";
      pos = to.end;
      i += 2;
    } else {
      const res = rw.ref(t);
      out += res ? refText(res) : "#REF!";
      pos = t.end;
    }
  }
  return "=" + out + body.slice(pos);
}

/**
 * Copy / fill / paste: shift relative parts by (dr, dc). A reference pushed off the sheet becomes #REF!.
 */
export function shiftFormula(raw: string, dr: number, dc: number, bounds: { rows: number; cols: number }): string {
  if (dr === 0 && dc === 0) return raw;
  return rewriteRefs(raw, {
    ref(ref) {
      const r = ref.absR ? ref.r : ref.r + dr;
      const c = ref.absC ? ref.c : ref.c + dc;
      if (r < 0 || c < 0 || r >= bounds.rows || c >= bounds.cols) return null;
      return { ...ref, r, c };
    },
  });
}

export type Axis = "row" | "col";

/**
 * Insert (count > 0) or delete (count < 0) rows/columns at `at` on one sheet, and fix every
 * reference that points there. Absolute refs move too; refs into deleted cells become #REF!;
 * ranges grow or shrink.
 */
export function structuralRewrite(
  raw: string,
  axis: Axis,
  at: number,
  count: number,
  limit: number,
  pointsAtTarget: (ref: RefToken) => boolean,
): string {
  const get = (ref: RefToken) => (axis === "row" ? ref.r : ref.c);
  const set = (ref: RefToken, v: number): RefToken => (axis === "row" ? { ...ref, r: v } : { ...ref, c: v });
  const del = count < 0 ? -count : 0;

  const moveOne = (v: number): number | null => {
    if (count > 0) {
      if (v < at) return v;
      return v + count < limit ? v + count : null;
    }
    if (v < at) return v;
    if (v < at + del) return null;
    return v - del;
  };

  return rewriteRefs(raw, {
    ref(ref) {
      if (!pointsAtTarget(ref)) return ref;
      const v = moveOne(get(ref));
      return v === null ? null : set(ref, v);
    },
    range(from, to) {
      if (!pointsAtTarget(from)) return [from, to];
      let a = get(from);
      let b = get(to);
      const flip = a > b;
      if (flip) [a, b] = [b, a];
      let na: number;
      let nb: number;
      if (count > 0) {
        na = a >= at ? a + count : a;
        nb = b >= at ? b + count : b;
        if (nb >= limit) nb = limit - 1;
        if (na >= limit) return null;
      } else {
        if (a >= at && b < at + del) return null; // whole range deleted
        na = a < at ? a : a < at + del ? at : a - del;
        nb = b < at ? b : b < at + del ? at - 1 : b - del;
      }
      return flip ? [set(from, nb), set(to, na)] : [set(from, na), set(to, nb)];
    },
  });
}

/**
 * Cut-paste moved `block` by (dr, dc): references into it follow the cells, as in Excel.
 * A single ref inside the block moves; a range moves only if both ends are inside; anything
 * else (refs elsewhere, ranges straddling the block edge) is left alone.
 */
export function moveRewrite(
  raw: string,
  block: { r1: number; c1: number; r2: number; c2: number },
  dr: number,
  dc: number,
  pointsAtSource: (ref: RefToken) => boolean,
): string {
  const inside = (r: RefToken) => r.r >= block.r1 && r.r <= block.r2 && r.c >= block.c1 && r.c <= block.c2;
  const move = (r: RefToken): RefToken => ({ ...r, r: r.r + dr, c: r.c + dc });
  return rewriteRefs(raw, {
    ref: (r) => (pointsAtSource(r) && inside(r) ? move(r) : r),
    range: (a, b) => (pointsAtSource(a) && inside(a) && inside(b) ? [move(a), move(b)] : [a, b]),
  });
}

const CYCLE: Array<[boolean, boolean]> = [
  [false, false], // A1
  [true, true], //  $A$1
  [false, true], // A$1
  [true, false], // $A1
];

/**
 * F4 / Cmd+T while editing: cycle the anchoring of the reference at the caret
 * A1 → $A$1 → A$1 → $A1 → A1. A range cycles both ends together. Returns null if no ref is at the caret.
 */
export function cycleAnchor(text: string, caret: number): { text: string; caret: number } | null {
  if (!text.startsWith("=")) return null;
  let toks: Token[];
  try {
    toks = tokenize(text.slice(1));
  } catch {
    return null;
  }
  const at = caret - 1; // positions inside the body
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    if (t.t !== "ref") continue;
    const colon = toks[i + 1];
    const end = toks[i + 2];
    const isRange = colon?.t === "op" && colon.v === ":" && end?.t === "ref";
    const last = isRange ? (end as RefTok) : t;
    if (at < t.start || at > last.end) {
      if (isRange) i += 2;
      continue;
    }
    const idx = CYCLE.findIndex(([c, r]) => c === t.absC && r === t.absR);
    const [absC, absR] = CYCLE[(idx + 1) % CYCLE.length]!;
    const first = refText({ ...t, absC, absR });
    const replaced = isRange ? `${first}:${refText({ ...(end as RefTok), absC, absR })}` : first;
    const startAbs = 1 + t.start;
    const endAbs = 1 + last.end;
    const newText = text.slice(0, startAbs) + replaced + text.slice(endAbs);
    return { text: newText, caret: startAbs + replaced.length };
  }
  return null;
}
