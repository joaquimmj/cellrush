import type { KeyChord, Platform } from "./types";

export interface CaptureCombo {
  id: string;
  chord: KeyChord;
  platform: Platform;
  /** Why it is risky to press when the browser does NOT hand it to the page. */
  risk?: "closes-tab" | "new-window" | "quits-app" | "os-level";
  note?: string;
}

const w = (id: string, chord: KeyChord, extra: Partial<CaptureCombo> = {}): CaptureCombo => ({ id, chord, platform: "win", ...extra });
const m = (id: string, chord: KeyChord, extra: Partial<CaptureCombo> = {}): CaptureCombo => ({ id, chord, platform: "mac", ...extra });

/**
 * Combos whose capturability we need to measure. Shortcuts that every browser hands to the page
 * (plain arrows, Ctrl+B…) are still listed when cheap to test, so the matrix proves it.
 */
export const CAPTURE_COMBOS: readonly CaptureCombo[] = [
  // Windows / Linux
  w("win.ctrl+w", { ctrl: true, char: "w" }, { risk: "closes-tab" }),
  w("win.ctrl+t", { ctrl: true, char: "t" }, { risk: "new-window" }),
  w("win.ctrl+n", { ctrl: true, char: "n" }, { risk: "new-window" }),
  w("win.ctrl+tab", { ctrl: true, code: "Tab" }),
  w("win.ctrl+shift+tab", { ctrl: true, shift: true, code: "Tab" }),
  w("win.ctrl+pageup", { ctrl: true, code: "PageUp" }, { note: "Excel: previous sheet" }),
  w("win.ctrl+pagedown", { ctrl: true, code: "PageDown" }, { note: "Excel: next sheet" }),
  w("win.ctrl+d", { ctrl: true, char: "d" }, { note: "Browser: bookmark" }),
  w("win.ctrl+r", { ctrl: true, char: "r" }, { note: "Browser: reload" }),
  w("win.ctrl+g", { ctrl: true, char: "g" }, { note: "Browser: find next" }),
  w("win.ctrl+1", { ctrl: true, code: "Digit1" }, { note: "Browser: tab 1" }),
  w("win.ctrl+9", { ctrl: true, code: "Digit9" }, { note: "Browser: last tab" }),
  w("win.ctrl+0", { ctrl: true, code: "Digit0" }, { note: "Browser: reset zoom" }),
  w("win.ctrl+minus", { ctrl: true, code: "Minus" }, { note: "Browser: zoom out" }),
  w("win.ctrl+shift+equal", { ctrl: true, shift: true, code: "Equal" }, { note: "Browser: zoom in" }),
  w("win.ctrl+shift+digit5", { ctrl: true, shift: true, code: "Digit5" }),
  w("win.ctrl+shift+digit7", { ctrl: true, shift: true, code: "Digit7" }),
  w("win.ctrl+space", { ctrl: true, code: "Space" }, { note: "OS: input method switch on some setups" }),
  w("win.shift+space", { shift: true, code: "Space" }),
  w("win.ctrl+enter", { ctrl: true, code: "Enter" }),
  w("win.alt+enter", { alt: true, code: "Enter" }),
  w("win.alt+equal", { alt: true, code: "Equal" }),
  w("win.alt+h", { alt: true, char: "h" }, { note: "Firefox/Edge: Help menu" }),
  w("win.alt", { alt: true, code: "AltLeft" }, { note: "Ribbon keytips start; browser menu bar" }),
  w("win.ctrl+alt+v", { ctrl: true, alt: true, char: "v" }),
  w("win.ctrl+semicolon", { ctrl: true, code: "Semicolon" }),
  w("win.ctrl+backquote", { ctrl: true, code: "Backquote" }),
  w("win.alt+shift+right", { alt: true, shift: true, code: "ArrowRight" }),
  w("win.f2", { code: "F2" }),
  w("win.f4", { code: "F4" }),
  w("win.f5", { code: "F5" }, { note: "Browser: reload" }),
  w("win.shift+f11", { shift: true, code: "F11" }),
  w("win.f11", { code: "F11" }, { note: "Browser: fullscreen" }),
  w("win.ctrl+home", { ctrl: true, code: "Home" }),
  w("win.ctrl+shift+end", { ctrl: true, shift: true, code: "End" }),
  w("win.ctrl+arrowdown", { ctrl: true, code: "ArrowDown" }),
  w("win.ctrl+shift+arrowright", { ctrl: true, shift: true, code: "ArrowRight" }),
  // macOS
  m("mac.cmd+w", { meta: true, char: "w" }, { risk: "closes-tab" }),
  m("mac.cmd+t", { meta: true, char: "t" }, { risk: "new-window" }),
  m("mac.cmd+n", { meta: true, char: "n" }, { risk: "new-window" }),
  m("mac.cmd+q", { meta: true, char: "q" }, { risk: "quits-app", note: "Never captured; listed for completeness — skip it" }),
  m("mac.cmd+h", { meta: true, char: "h" }, { risk: "os-level", note: "Hides the app" }),
  m("mac.cmd+m", { meta: true, char: "m" }, { risk: "os-level", note: "Minimizes the window" }),
  m("mac.cmd+d", { meta: true, char: "d" }, { note: "Excel Mac: fill down. Browser: bookmark" }),
  m("mac.cmd+r", { meta: true, char: "r" }, { note: "Excel Mac: fill right. Browser: reload" }),
  m("mac.cmd+b", { meta: true, char: "b" }),
  m("mac.cmd+1", { meta: true, code: "Digit1" }, { note: "Excel Mac: Format Cells. Browser: tab 1" }),
  m("mac.cmd+shift+digit5", { meta: true, shift: true, code: "Digit5" }),
  m("mac.ctrl+shift+digit5", { ctrl: true, shift: true, code: "Digit5" }),
  m("mac.cmd+arrowdown", { meta: true, code: "ArrowDown" }),
  m("mac.cmd+shift+arrowright", { meta: true, shift: true, code: "ArrowRight" }),
  m("mac.ctrl+arrowdown", { ctrl: true, code: "ArrowDown" }, { risk: "os-level", note: "Mission Control: app windows" }),
  m("mac.ctrl+space", { ctrl: true, code: "Space" }, { risk: "os-level", note: "Input source switch" }),
  m("mac.cmd+space", { meta: true, code: "Space" }, { risk: "os-level", note: "Spotlight" }),
  m("mac.shift+space", { shift: true, code: "Space" }),
  m("mac.cmd+enter", { meta: true, code: "Enter" }),
  m("mac.ctrl+u", { ctrl: true, char: "u" }, { note: "Excel Mac: edit cell" }),
  m("mac.fn+f2", { code: "F2" }),
  m("mac.cmd+y", { meta: true, char: "y" }, { note: "Browser: history" }),
  m("mac.cmd+option+v", { meta: true, alt: true, char: "v" }),
  m("mac.cmd+shift+equal", { meta: true, shift: true, code: "Equal" }, { note: "Browser: zoom in" }),
  m("mac.cmd+minus", { meta: true, code: "Minus" }, { note: "Browser: zoom out" }),
  m("mac.ctrl+pagedown", { ctrl: true, code: "PageDown" }),
  m("mac.option+pagedown", { alt: true, code: "PageDown" }),
];
