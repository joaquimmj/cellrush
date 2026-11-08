import {
  createSheet, createState, dispatchKey, fillFromRows, getCell, parseA1, rangeToA1, rawFromChord, selRange, toA1,
  type GridState, type KeyChord, type LayoutId, type Platform, type RawKey,
} from "../src";

/** Parse "ctrl+shift+ArrowDown", "F2", "a", "meta+b" into a chord. Single chars are char-based; names are codes. */
export function chord(spec: string): KeyChord {
  const parts = spec.split("+");
  const key = parts.pop()!;
  const mods = { ctrl: parts.includes("ctrl"), shift: parts.includes("shift"), alt: parts.includes("alt"), meta: parts.includes("meta") };
  return key.length === 1 && /[a-z;']/.test(key) ? { ...mods, char: key } : { ...mods, code: key };
}

export interface Ctx {
  platform?: Platform;
  layout?: LayoutId;
}

export function press(st: GridState, spec: string, ctx: Ctx = {}): GridState {
  const layout = ctx.layout ?? "us";
  return dispatchKey(st, rawFromChord(chord(spec), layout), { platform: ctx.platform ?? "win", layout }).state;
}

/** Press several keys: "ctrl+d, F2, Enter". */
export function keys(st: GridState, specs: string, ctx: Ctx = {}): GridState {
  return specs.split(",").map((s) => s.trim()).filter(Boolean).reduce((s, k) => press(s, k, ctx), st);
}

/** Type literal text as individual key presses. */
export function type(st: GridState, text: string, ctx: Ctx = {}): GridState {
  let s = st;
  for (const ch of text) {
    const raw: RawKey = { code: ch === " " ? "Space" : `Key${ch.toUpperCase()}`, key: ch, ctrl: false, shift: false, alt: false, meta: false };
    if (/\d/.test(ch)) raw.code = `Digit${ch}`;
    if (ch === ".") raw.code = "Period";
    if (ch === "=") raw.code = "Equal";
    s = dispatchKey(s, raw, { platform: ctx.platform ?? "win", layout: ctx.layout ?? "us" }).state;
  }
  return s;
}

export function grid(rows: ReadonlyArray<ReadonlyArray<string | number | null>>, at = "A1", origin = "A1"): GridState {
  return createState({ sheets: [fillFromRows(createSheet(), rows, parseA1(origin))], active: parseA1(at), options: { today: "2026-11-08" } });
}

export const at = (st: GridState) => toA1(st.sel.active);
export const sel = (st: GridState) => rangeToA1(selRange(st.sel));
export const raw = (st: GridState, ref: string) => getCell(st.sheets[st.sheetIndex]!, parseA1(ref))?.raw ?? "";
export const cell = (st: GridState, ref: string) => getCell(st.sheets[st.sheetIndex]!, parseA1(ref));
