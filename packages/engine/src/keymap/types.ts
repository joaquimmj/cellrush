export type Platform = "win" | "mac";
export type LayoutId = "us" | "uk" | "fr-azerty" | "de-qwertz";

/** Raw, DOM-free snapshot of a keydown event. */
export interface RawKey {
  code: string; // KeyboardEvent.code (physical key)
  key: string; // KeyboardEvent.key (produced character / named key)
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

export interface Modifiers {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

/**
 * How a shortcut identifies its key.
 * - `code`: positional (digit row, F-keys, arrows, Enter…). Same physical key on every layout.
 * - `char`: the letter printed on the key (Ctrl+B is the key labelled B, wherever the layout puts it).
 */
export type KeyChord =
  | (Modifiers & { code: string; char?: never })
  | (Modifiers & { char: string; code?: never });

/** A Windows ribbon keytip sequence: Alt, then these keys one by one (e.g. ["H", "O", "I"]). */
export type KeySequence = { keytip: string[] };
