import { charForCode, codeForChar, rawFromChord, type KeyChord, type LayoutId, type RawKey } from "@cellrush/engine";
import type { Stroke } from "./types";

const MOD_CODES: Record<string, Partial<RawKey>> = {
  AltLeft: { alt: true, key: "Alt" },
};

/** One stroke spec → the keydown(s) it produces. "type:abc" produces one keydown per character. */
export function strokeToRaws(spec: Stroke, layout: LayoutId): RawKey[] {
  if (spec.startsWith("type:")) return [...spec.slice(5)].map((ch) => charToRaw(ch, layout));
  if (MOD_CODES[spec]) return [{ code: spec, key: "", ctrl: false, shift: false, alt: false, meta: false, ...MOD_CODES[spec] }];
  const parts = spec.split("+");
  const key = parts.pop()!;
  const mods = { ctrl: parts.includes("ctrl"), shift: parts.includes("shift"), alt: parts.includes("alt"), meta: parts.includes("meta") };
  const chord: KeyChord = key.length === 1 ? { ...mods, char: key } : { ...mods, code: key };
  if (key.length === 1 && !mods.ctrl && !mods.meta && !mods.alt) {
    // A bare letter (dialog choice, keytip): a plain key press, shift as given.
    const raw = charToRaw(key, layout);
    return [{ ...raw, shift: mods.shift || raw.shift }];
  }
  return [rawFromChord(chord, layout)];
}

export function charToRaw(ch: string, layout: LayoutId): RawKey {
  if (ch === " ") return { code: "Space", key: " ", ctrl: false, shift: false, alt: false, meta: false };
  const lower = ch.toLowerCase();
  const isUpperLetter = ch !== lower && /[a-z]/.test(lower);
  const hit = codeForChar(layout, isUpperLetter ? lower : ch);
  if (!hit) throw new Error(`cannot type "${ch}" on ${layout}`);
  const shift = isUpperLetter || hit.shift;
  return { code: hit.code, key: charForCode(layout, hit.code, shift) ?? ch, ctrl: false, shift, alt: false, meta: false };
}

/** Keystroke count of a path ("type:abc" = 3; a lone modifier such as "AltLeft" = 0, like in runs). */
export function strokeCount(path: readonly Stroke[]): number {
  return path.reduce((n, s) => n + (s.startsWith("type:") ? s.length - 5 : MOD_CODES[s] ? 0 : 1), 0);
}
