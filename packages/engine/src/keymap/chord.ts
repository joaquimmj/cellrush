import { charForCode, codeForChar } from "./layouts";
import type { KeyChord, LayoutId, Platform, RawKey } from "./types";

const MOD_CODES = new Set([
  "ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight", "AltLeft", "AltRight",
  "MetaLeft", "MetaRight", "OSLeft", "OSRight", "CapsLock", "Fn",
]);

export function isModifierOnly(raw: RawKey): boolean {
  return MOD_CODES.has(raw.code);
}

/** Letter (lowercased) printed on the pressed key, resolved through the layout so Alt/Option junk is ignored. */
export function charOf(raw: RawKey, layout: LayoutId): string | undefined {
  const fromLayout = charForCode(layout, raw.code, false);
  if (fromLayout) return fromLayout.toLowerCase();
  return raw.key.length === 1 ? raw.key.toLowerCase() : undefined;
}

function modsEqual(chord: KeyChord, raw: RawKey): boolean {
  return (
    !!chord.ctrl === raw.ctrl &&
    !!chord.shift === raw.shift &&
    !!chord.alt === raw.alt &&
    !!chord.meta === raw.meta
  );
}

/** Keys that laptops produce with Fn+Arrow: `code` stays "ArrowLeft" but `key` becomes "Home". */
const NAV_KEYS = new Set(["Home", "End", "PageUp", "PageDown"]);

/** Does a keydown satisfy a chord definition on the given layout? */
export function matchesChord(chord: KeyChord, raw: RawKey, layout: LayoutId): boolean {
  if (!modsEqual(chord, raw)) return false;
  if (chord.code !== undefined) {
    if (NAV_KEYS.has(raw.key) && raw.key !== raw.code) return chord.code === raw.key;
    return chord.code === raw.code;
  }
  return charOf(raw, layout) === chord.char.toLowerCase();
}

const NAMED: Record<string, string> = {
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Enter: "Enter", Escape: "Esc",
  Tab: "Tab", Space: "Space", Backspace: "Backspace", Delete: "Delete", Home: "Home", End: "End",
  PageUp: "PgUp", PageDown: "PgDn",
};

/** Human label of the key part of a chord, shown with the layout's own printed character. */
export function keyLabel(chord: KeyChord, layout: LayoutId): string {
  if (chord.char !== undefined) return chord.char.toUpperCase();
  const code = chord.code;
  if (NAMED[code]) return NAMED[code];
  if (/^F\d{1,2}$/.test(code)) return code;
  // Show what the key prints with the modifiers held, like Microsoft's docs ("Ctrl+Shift+%").
  const ch = charForCode(layout, code, !!chord.shift);
  if (ch) return ch.toUpperCase();
  return code;
}

export function formatChord(chord: KeyChord, platform: Platform, layout: LayoutId): string {
  const key = keyLabel(chord, layout);
  if (platform === "mac") {
    return `${chord.ctrl ? "⌃" : ""}${chord.alt ? "⌥" : ""}${chord.shift ? "⇧" : ""}${chord.meta ? "⌘" : ""}${key}`;
  }
  const parts: string[] = [];
  if (chord.ctrl) parts.push("Ctrl");
  if (chord.alt) parts.push("Alt");
  if (chord.shift) parts.push("Shift");
  if (chord.meta) parts.push("Win");
  parts.push(key);
  return parts.join("+");
}

/** Physical keydown that would produce a chord on a layout (used by tests and replays). */
export function rawFromChord(chord: KeyChord, layout: LayoutId): RawKey {
  let code: string;
  let key: string;
  if (chord.code !== undefined) {
    code = chord.code;
    key = code === "Space" ? " " : (charForCode(layout, code, !!chord.shift) ?? code);
  } else {
    const hit = codeForChar(layout, chord.char.toLowerCase());
    if (!hit) throw new Error(`char "${chord.char}" not on layout ${layout}`);
    if (hit.shift && !chord.shift) throw new Error(`char "${chord.char}" needs Shift on layout ${layout}`);
    code = hit.code;
    key = charForCode(layout, code, !!chord.shift) ?? chord.char;
  }
  return { code, key, ctrl: !!chord.ctrl, shift: !!chord.shift, alt: !!chord.alt, meta: !!chord.meta };
}

/** Stable id for a raw keydown, e.g. "ctrl+shift+Digit5". */
export function rawId(raw: RawKey): string {
  const mods = [raw.ctrl && "ctrl", raw.alt && "alt", raw.shift && "shift", raw.meta && "meta"].filter(Boolean);
  return [...mods, raw.code].join("+");
}
