import type { Action } from "../grid/state";
import type { Dir } from "../grid/navigation";
import type { KeyChord, KeySequence, Platform } from "./types";

export type ShortcutCategory =
  | "navigation" | "selection" | "editing" | "rows-cols" | "formatting" | "clipboard" | "formulas" | "sheets" | "ribbon";

export type KeyBinding = KeyChord[] | KeySequence;

export interface ShortcutDef {
  id: string;
  action: Action;
  category: ShortcutCategory;
  win: KeyBinding | null;
  /** null = not available on Mac. Never invent a Mac equivalent: leave null until checked. */
  mac: KeyBinding | null;
  /** Checked against Microsoft's official "Keyboard shortcuts in Excel" page, per platform. */
  verified: { win: boolean; mac: boolean };
  source: string;
  notes?: string;
}

export const MS_SHORTCUTS_URL =
  "https://support.microsoft.com/en-us/office/keyboard-shortcuts-in-excel-1798d9d5-842a-42b8-9c99-9b7213f0040f";

const V = { win: true, mac: true };
const def = (d: Omit<ShortcutDef, "source"> & { source?: string }): ShortcutDef => ({ source: MS_SHORTCUTS_URL, ...d });

const ARROW: Record<Dir, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

function arrowDefs(): ShortcutDef[] {
  const out: ShortcutDef[] = [];
  for (const dir of Object.keys(ARROW) as Dir[]) {
    const code = ARROW[dir];
    out.push(
      def({ id: `move-${dir}`, category: "navigation", action: { type: "move", dir }, win: [{ code }], mac: [{ code }], verified: V }),
      def({ id: `extend-${dir}`, category: "selection", action: { type: "move", dir, extend: true }, win: [{ shift: true, code }], mac: [{ shift: true, code }], verified: V }),
      def({ id: `jump-${dir}`, category: "navigation", action: { type: "move", dir, jump: true }, win: [{ ctrl: true, code }], mac: [{ meta: true, code }], verified: V }),
      def({ id: `jump-extend-${dir}`, category: "selection", action: { type: "move", dir, jump: true, extend: true }, win: [{ ctrl: true, shift: true, code }], mac: [{ meta: true, shift: true, code }], verified: V }),
    );
  }
  return out;
}

export const SHORTCUTS: readonly ShortcutDef[] = [
  ...arrowDefs(),
  // ── navigation ──
  def({ id: "go-home", category: "navigation", action: { type: "ctrlHome" }, win: [{ ctrl: true, code: "Home" }], mac: [{ ctrl: true, code: "Home" }], verified: V }),
  def({ id: "go-last-cell", category: "navigation", action: { type: "ctrlEnd" }, win: [{ ctrl: true, code: "End" }], mac: [{ ctrl: true, code: "End" }], verified: V }),
  def({ id: "row-start", category: "navigation", action: { type: "home" }, win: [{ code: "Home" }], mac: [{ code: "Home" }], verified: V }),
  def({ id: "page-down", category: "navigation", action: { type: "page", dir: "down" }, win: [{ code: "PageDown" }], mac: [{ code: "PageDown" }], verified: V }),
  def({ id: "page-up", category: "navigation", action: { type: "page", dir: "up" }, win: [{ code: "PageUp" }], mac: [{ code: "PageUp" }], verified: V }),
  def({ id: "commit-down", category: "navigation", action: { type: "commit", dir: "down" }, win: [{ code: "Enter" }], mac: [{ code: "Enter" }], verified: V }),
  def({ id: "commit-up", category: "navigation", action: { type: "commit", dir: "up" }, win: [{ shift: true, code: "Enter" }], mac: [{ shift: true, code: "Enter" }], verified: V }),
  def({ id: "commit-right", category: "navigation", action: { type: "commit", dir: "right" }, win: [{ code: "Tab" }], mac: [{ code: "Tab" }], verified: V }),
  def({ id: "commit-left", category: "navigation", action: { type: "commit", dir: "left" }, win: [{ shift: true, code: "Tab" }], mac: [{ shift: true, code: "Tab" }], verified: V }),
  // ── selection ──
  def({ id: "extend-to-start", category: "selection", action: { type: "ctrlHome", extend: true }, win: [{ ctrl: true, shift: true, code: "Home" }], mac: [{ ctrl: true, shift: true, code: "Home" }], verified: { win: true, mac: false } }),
  def({ id: "extend-to-last-cell", category: "selection", action: { type: "ctrlEnd", extend: true }, win: [{ ctrl: true, shift: true, code: "End" }], mac: [{ ctrl: true, shift: true, code: "End" }], verified: V }),
  def({ id: "extend-row-start", category: "selection", action: { type: "home", extend: true }, win: [{ shift: true, code: "Home" }], mac: [{ shift: true, code: "Home" }], verified: { win: false, mac: true }, notes: "Windows: not on the MS page (works in Excel); verify." }),
  def({ id: "extend-page-down", category: "selection", action: { type: "page", dir: "down", extend: true }, win: [{ shift: true, code: "PageDown" }], mac: [{ shift: true, code: "PageDown" }], verified: { win: false, mac: false } }),
  def({ id: "extend-page-up", category: "selection", action: { type: "page", dir: "up", extend: true }, win: [{ shift: true, code: "PageUp" }], mac: [{ shift: true, code: "PageUp" }], verified: { win: false, mac: false } }),
  def({ id: "select-row", category: "selection", action: { type: "selectRow" }, win: [{ shift: true, code: "Space" }], mac: [{ shift: true, code: "Space" }], verified: V }),
  def({ id: "select-column", category: "selection", action: { type: "selectColumn" }, win: [{ ctrl: true, code: "Space" }], mac: [{ ctrl: true, code: "Space" }], verified: V, notes: "macOS uses Ctrl+Space for input sources; may need to be freed in System Settings." }),
  def({ id: "select-all", category: "selection", action: { type: "selectAll" }, win: [{ ctrl: true, char: "a" }, { ctrl: true, shift: true, code: "Space" }], mac: [{ meta: true, char: "a" }, { meta: true, shift: true, code: "Space" }], verified: V, notes: "Current region first, whole sheet on second press." }),
  // ── editing ──
  def({ id: "edit-cell", category: "editing", action: { type: "editCell" }, win: [{ code: "F2" }], mac: [{ code: "F2" }, { ctrl: true, char: "u" }], verified: V }),
  def({ id: "cancel", category: "editing", action: { type: "cancel" }, win: [{ code: "Escape" }], mac: [{ code: "Escape" }], verified: V }),
  def({ id: "clear-contents", category: "editing", action: { type: "deleteKey" }, win: [{ code: "Delete" }], mac: [{ code: "Delete" }], verified: V }),
  def({ id: "fill-selection", category: "editing", action: { type: "commitAll" }, win: [{ ctrl: true, code: "Enter" }], mac: [{ meta: true, code: "Enter" }, { ctrl: true, code: "Enter" }], verified: V }),
  def({ id: "fill-down", category: "editing", action: { type: "fillDown" }, win: [{ ctrl: true, char: "d" }], mac: [{ ctrl: true, char: "d" }, { meta: true, char: "d" }], verified: V }),
  def({ id: "fill-right", category: "editing", action: { type: "fillRight" }, win: [{ ctrl: true, char: "r" }], mac: [{ ctrl: true, char: "r" }, { meta: true, char: "r" }], verified: V }),
  def({ id: "line-break", category: "editing", action: { type: "newline" }, win: [{ alt: true, code: "Enter" }], mac: [{ alt: true, code: "Enter" }, { ctrl: true, alt: true, code: "Enter" }], verified: V }),
  def({ id: "insert-date", category: "editing", action: { type: "insertDate" }, win: [{ ctrl: true, char: ";" }], mac: [{ ctrl: true, char: ";" }], verified: V, notes: "Char-based: on QWERTZ ';' needs Shift, not covered yet." }),
  def({ id: "copy-from-above", category: "editing", action: { type: "copyFromAbove" }, win: [{ ctrl: true, char: "'" }], mac: [{ ctrl: true, char: "'" }], verified: V }),
  def({ id: "undo", category: "editing", action: { type: "undo" }, win: [{ ctrl: true, char: "z" }], mac: [{ meta: true, char: "z" }, { ctrl: true, char: "z" }], verified: V }),
  def({ id: "redo", category: "editing", action: { type: "redoOrRepeat" }, win: [{ ctrl: true, char: "y" }], mac: null, verified: { win: true, mac: false }, notes: "Windows: MS lists Ctrl+Y as Repeat; Excel redoes first when there is something to redo." }),
  def({ id: "redo-mac", category: "editing", action: { type: "redo" }, win: null, mac: [{ meta: true, char: "y" }, { ctrl: true, char: "y" }, { meta: true, shift: true, char: "z" }], verified: { win: false, mac: true } }),
  def({ id: "repeat", category: "editing", action: { type: "repeat" }, win: [{ code: "F4" }], mac: null, verified: { win: true, mac: false }, notes: "Ready mode: repeat last action. While editing a formula: cycle $ anchoring of the reference at the caret." }),
  // ── clipboard ──
  def({ id: "copy", category: "clipboard", action: { type: "copy" }, win: [{ ctrl: true, char: "c" }], mac: [{ meta: true, char: "c" }, { ctrl: true, char: "c" }], verified: V }),
  def({ id: "cut", category: "clipboard", action: { type: "cut" }, win: [{ ctrl: true, char: "x" }], mac: [{ meta: true, char: "x" }, { ctrl: true, char: "x" }], verified: V }),
  def({ id: "paste", category: "clipboard", action: { type: "paste" }, win: [{ ctrl: true, char: "v" }], mac: [{ meta: true, char: "v" }, { ctrl: true, char: "v" }], verified: V }),
  def({ id: "paste-special", category: "clipboard", action: { type: "pasteSpecialDialog" }, win: [{ ctrl: true, alt: true, char: "v" }], mac: [{ meta: true, ctrl: true, char: "v" }, { ctrl: true, alt: true, char: "v" }, { meta: true, alt: true, char: "v" }], verified: V, notes: "Then V (values), F (formulas), T (formats), A (all) and Enter. Letters verified for Windows; Mac page lists none." }),
  def({ id: "paste-special-legacy", category: "ribbon", action: { type: "pasteSpecialDialog" }, win: { keytip: ["E", "S"] }, mac: null, verified: { win: true, mac: false }, notes: "Legacy Excel 2003 menu path Alt, E, S." }),
  // ── rows & columns ──
  def({ id: "insert-cells", category: "rows-cols", action: { type: "insertCells" }, win: [{ ctrl: true, shift: true, code: "Equal" }], mac: [{ ctrl: true, shift: true, code: "Equal" }], verified: V, notes: "Whole rows/columns selected: inserts directly. Otherwise a dialog: R = entire row, C = entire column (dialog letters are not on the MS page)." }),
  def({ id: "delete-cells", category: "rows-cols", action: { type: "deleteCells" }, win: [{ ctrl: true, code: "Minus" }], mac: [{ meta: true, code: "Minus" }, { ctrl: true, code: "Minus" }], verified: V, notes: "Same dialog rules as insert." }),
  // ── formulas ──
  def({ id: "autosum", category: "formulas", action: { type: "autoSum" }, win: [{ alt: true, code: "Equal" }], mac: [{ meta: true, shift: true, char: "t" }], verified: V }),
  def({ id: "toggle-anchor", category: "formulas", action: { type: "toggleAnchor" }, win: null, mac: [{ meta: true, char: "t" }, { code: "F4" }], verified: { win: false, mac: true }, notes: "Windows uses F4 (the 'repeat' entry) for this while editing. Cmd+T is browser-reserved: needs the capture matrix." }),
  // ── sheets ──
  def({ id: "next-sheet", category: "sheets", action: { type: "nextSheet" }, win: [{ ctrl: true, code: "PageDown" }], mac: [{ ctrl: true, code: "PageDown" }, { alt: true, code: "ArrowRight" }], verified: V }),
  def({ id: "prev-sheet", category: "sheets", action: { type: "prevSheet" }, win: [{ ctrl: true, code: "PageUp" }], mac: [{ alt: true, code: "ArrowLeft" }, { ctrl: true, code: "PageUp" }], verified: V, notes: "Mac page lists Ctrl+Page down for both directions (typo); Ctrl+Page up assumed for previous." }),
  def({ id: "insert-sheet", category: "sheets", action: { type: "insertSheet" }, win: [{ shift: true, code: "F11" }, { alt: true, shift: true, code: "F1" }], mac: [{ shift: true, code: "F11" }], verified: V }),
  // ── formatting ──
  def({ id: "bold", category: "formatting", action: { type: "toggleFormat", prop: "bold" }, win: [{ ctrl: true, char: "b" }], mac: [{ meta: true, char: "b" }, { ctrl: true, char: "b" }], verified: V }),
  def({ id: "italic", category: "formatting", action: { type: "toggleFormat", prop: "italic" }, win: [{ ctrl: true, char: "i" }], mac: [{ meta: true, char: "i" }, { ctrl: true, char: "i" }], verified: V }),
  def({ id: "underline", category: "formatting", action: { type: "toggleFormat", prop: "underline" }, win: [{ ctrl: true, char: "u" }], mac: [{ meta: true, char: "u" }], verified: V }),
  def({ id: "format-number", category: "formatting", action: { type: "numberFormat", format: "number" }, win: [{ ctrl: true, shift: true, code: "Digit1" }], mac: [{ ctrl: true, shift: true, code: "Digit1" }], verified: V, notes: "Ctrl+Shift+! on US layouts; positional (digit row)." }),
  def({ id: "format-currency", category: "formatting", action: { type: "numberFormat", format: "currency" }, win: [{ ctrl: true, shift: true, code: "Digit4" }], mac: [{ ctrl: true, shift: true, code: "Digit4" }], verified: V, notes: "Ctrl+Shift+$ on US layouts." }),
  def({ id: "format-percent", category: "formatting", action: { type: "numberFormat", format: "percent" }, win: [{ ctrl: true, shift: true, code: "Digit5" }], mac: [{ ctrl: true, shift: true, code: "Digit5" }], verified: V, notes: "Ctrl+Shift+% on US layouts." }),
  def({ id: "format-date", category: "formatting", action: { type: "numberFormat", format: "date" }, win: [{ ctrl: true, shift: true, code: "Digit3" }], mac: [{ ctrl: true, shift: true, code: "Digit3" }], verified: V, notes: "Ctrl+Shift+# on US layouts." }),
  def({ id: "format-general", category: "formatting", action: { type: "numberFormat", format: "general" }, win: [{ ctrl: true, shift: true, code: "Backquote" }], mac: [{ ctrl: true, shift: true, code: "Backquote" }], verified: V, notes: "Ctrl+Shift+~ on US layouts." }),
  def({ id: "outline-border", category: "formatting", action: { type: "outlineBorder" }, win: [{ ctrl: true, shift: true, code: "Digit7" }], mac: [{ meta: true, alt: true, code: "Digit0" }], verified: V, notes: "Ctrl+Shift+& on US layouts (positional)." }),
  def({ id: "remove-borders", category: "formatting", action: { type: "removeBorders" }, win: [{ ctrl: true, shift: true, code: "Minus" }], mac: [{ meta: true, alt: true, code: "Minus" }], verified: V, notes: "Ctrl+Shift+_ on US layouts (positional)." }),
  // ── formulas ──
  def({ id: "show-formulas", category: "formulas", action: { type: "toggleShowFormulas" }, win: [{ ctrl: true, code: "Backquote" }], mac: [{ ctrl: true, code: "Backquote" }], verified: V }),
  // ── ribbon keytips (Windows) ──
  def({ id: "autofit-column", category: "ribbon", action: { type: "autofitColumn" }, win: { keytip: ["H", "O", "I"] }, mac: null, verified: { win: false, mac: false }, notes: "Ribbon keytip; not on the MS shortcut page. Verify in Excel desktop." }),
  def({ id: "increase-decimal", category: "ribbon", action: { type: "decimals", delta: 1 }, win: { keytip: ["H", "0"] }, mac: null, verified: { win: false, mac: false }, notes: "Ribbon keytip; verify in Excel desktop." }),
  def({ id: "font-color", category: "ribbon", action: { type: "colorDialog", target: "font" }, win: { keytip: ["H", "F", "C"] }, mac: null, verified: { win: false, mac: false }, notes: "Ribbon keytip; then ← → through a simplified Standard Colors row and Enter. No Mac shortcut exists." }),
  def({ id: "fill-color", category: "ribbon", action: { type: "colorDialog", target: "fill" }, win: { keytip: ["H", "H"] }, mac: null, verified: { win: false, mac: false }, notes: "Ribbon keytip; same palette as font colour." }),
  def({ id: "decrease-decimal", category: "ribbon", action: { type: "decimals", delta: -1 }, win: { keytip: ["H", "9"] }, mac: null, verified: { win: false, mac: false }, notes: "Ribbon keytip; verify in Excel desktop." }),
];

export const isKeytip = (b: KeyBinding | null): b is KeySequence => !!b && !Array.isArray(b);
export const bindingFor = (d: ShortcutDef, p: Platform): KeyBinding | null => (p === "win" ? d.win : d.mac);
export const shortcutById = (id: string): ShortcutDef | undefined => SHORTCUTS.find((s) => s.id === id);
