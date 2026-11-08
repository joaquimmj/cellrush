import { reduce } from "./grid/reducer";
import type { GridState } from "./grid/state";
import { charOf, isModifierOnly, matchesChord } from "./keymap/chord";
import { SHORTCUTS, bindingFor, isKeytip, type ShortcutDef } from "./keymap/registry";
import type { LayoutId, Platform, RawKey } from "./keymap/types";

export interface DispatchContext {
  platform: Platform;
  layout: LayoutId;
}

export interface DispatchResult {
  state: GridState;
  /** The page should call preventDefault(). */
  handled: boolean;
  /** Registry id of the shortcut that fired, if any (feeds scoring and Learn hints). */
  shortcutId?: string;
}

const printable = (raw: RawKey, platform: Platform) =>
  raw.key.length === 1 && !raw.ctrl && !raw.meta && (!raw.alt || platform === "mac");

export function findChord(raw: RawKey, ctx: DispatchContext): ShortcutDef | undefined {
  return SHORTCUTS.find((d) => {
    const b = bindingFor(d, ctx.platform);
    return Array.isArray(b) && b.some((ch) => matchesChord(ch, raw, ctx.layout));
  });
}

/** Keytip letter for a key: digits stay digits on every layout (AZERTY's "&" key is still "1"). */
function keytipChar(raw: RawKey, layout: LayoutId): string | undefined {
  const digit = /^Digit(\d)$/.exec(raw.code);
  if (digit) return digit[1];
  return charOf(raw, layout)?.toUpperCase();
}

function keytipStep(st: GridState, raw: RawKey, ctx: DispatchContext): DispatchResult {
  if (raw.code === "Escape") return { state: { ...st, keytip: null }, handled: true };
  const ch = keytipChar(raw, ctx.layout);
  if (!ch) return { state: { ...st, keytip: null }, handled: true };
  const prefix = [...(st.keytip ?? []), ch];
  const candidates = SHORTCUTS.filter((d) => {
    const b = bindingFor(d, ctx.platform);
    return isKeytip(b) && prefix.every((k, i) => b.keytip[i] === k);
  });
  const full = candidates.find((d) => (bindingFor(d, ctx.platform) as { keytip: string[] }).keytip.length === prefix.length);
  if (full) return { state: reduce({ ...st, keytip: null }, full.action), handled: true, shortcutId: full.id };
  return { state: { ...st, keytip: candidates.length ? prefix : null }, handled: true };
}

/**
 * Turn one keydown into a state change. Deterministic and DOM-free, so the same event list
 * replays to the same result in the browser and on the server.
 */
export function dispatchKey(st: GridState, raw: RawKey, ctx: DispatchContext): DispatchResult {
  const editing = st.mode !== "ready";

  if (isModifierOnly(raw)) {
    const loneAlt = (raw.code === "AltLeft" || raw.code === "AltRight") && !raw.ctrl && !raw.meta && !raw.shift;
    if (ctx.platform === "win" && loneAlt && !editing) return { state: { ...st, keytip: [] }, handled: true };
    return { state: st, handled: false };
  }

  // While typing in a cell, plain characters are text (Shift+Space is a space, not "select row").
  if (editing && printable(raw, ctx.platform)) return { state: reduce(st, { type: "input", text: raw.key }), handled: true };

  const hit = findChord(raw, ctx);
  if (hit) return { state: reduce({ ...st, keytip: null }, hit.action), handled: true, shortcutId: hit.id };

  if (!editing && ctx.platform === "win") {
    if (st.keytip !== null) return keytipStep(st, raw, ctx);
    // Alt held down with a letter (Alt+H…) starts a keytip sequence too.
    if (raw.alt && !raw.ctrl && !raw.meta) return keytipStep({ ...st, keytip: [] }, raw, ctx);
  }

  if (raw.code === "Backspace" && !raw.ctrl && !raw.meta) return { state: reduce(st, { type: "backspace" }), handled: true };
  if (raw.code === "End" && editing) return { state: reduce(st, { type: "end" }), handled: true };
  if (!editing && printable(raw, ctx.platform)) return { state: reduce(st, { type: "input", text: raw.key }), handled: true };

  return { state: st, handled: false };
}
