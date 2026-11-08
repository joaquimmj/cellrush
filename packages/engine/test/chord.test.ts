import { describe, expect, it } from "vitest";
import { formatChord, matchesChord, rawFromChord, rawId, isModifierOnly, type KeyChord, type LayoutId, type RawKey } from "../src";

const raw = (p: Partial<RawKey>): RawKey => ({ code: "", key: "", ctrl: false, shift: false, alt: false, meta: false, ...p });
const LAYOUTS: LayoutId[] = ["us", "uk", "fr-azerty", "de-qwertz"];

describe("matchesChord — char shortcuts follow the printed letter", () => {
  const ctrlA: KeyChord = { ctrl: true, char: "a" };
  it("US: Ctrl + KeyA", () => expect(matchesChord(ctrlA, raw({ code: "KeyA", key: "a", ctrl: true }), "us")).toBe(true));
  it("AZERTY: Ctrl + KeyQ is Ctrl+A", () => expect(matchesChord(ctrlA, raw({ code: "KeyQ", key: "a", ctrl: true }), "fr-azerty")).toBe(true));
  it("AZERTY: Ctrl + KeyA is NOT Ctrl+A", () => expect(matchesChord(ctrlA, raw({ code: "KeyA", key: "q", ctrl: true }), "fr-azerty")).toBe(false));
  it("QWERTZ: Ctrl + KeyY is Ctrl+Z", () => expect(matchesChord({ ctrl: true, char: "z" }, raw({ code: "KeyY", key: "z", ctrl: true }), "de-qwertz")).toBe(true));
  it("ignores Mac Option garbage in event.key", () =>
    expect(matchesChord({ meta: true, alt: true, char: "v" }, raw({ code: "KeyV", key: "◊", meta: true, alt: true }), "us")).toBe(true));
});

describe("matchesChord — code shortcuts are positional", () => {
  const pct: KeyChord = { ctrl: true, shift: true, code: "Digit5" };
  it.each(LAYOUTS)("%s: Ctrl+Shift+Digit5 matches", (l) =>
    expect(matchesChord(pct, raw({ code: "Digit5", key: "%", ctrl: true, shift: true }), l)).toBe(true));
  it("requires exact modifiers", () => {
    expect(matchesChord(pct, raw({ code: "Digit5", ctrl: true }), "us")).toBe(false);
    expect(matchesChord(pct, raw({ code: "Digit5", ctrl: true, shift: true, alt: true }), "us")).toBe(false);
  });
  it("arrows", () => expect(matchesChord({ ctrl: true, code: "ArrowDown" }, raw({ code: "ArrowDown", key: "ArrowDown", ctrl: true }), "fr-azerty")).toBe(true));
});

describe("rawFromChord round-trips through matchesChord", () => {
  const chords: KeyChord[] = [
    { ctrl: true, char: "b" }, { ctrl: true, char: "a" }, { ctrl: true, char: "z" }, { ctrl: true, char: "m" },
    { ctrl: true, shift: true, code: "Digit5" }, { code: "F4" }, { shift: true, code: "Space" }, { meta: true, char: "w" },
  ];
  for (const l of LAYOUTS) for (const c of chords)
    it(`${l} ${JSON.stringify(c)}`, () => expect(matchesChord(c, rawFromChord(c, l), l)).toBe(true));
});

describe("formatChord", () => {
  it("windows", () => expect(formatChord({ ctrl: true, shift: true, code: "Digit5" }, "win", "us")).toBe("Ctrl+Shift+%"));
  it("windows AZERTY shows the printed char", () => expect(formatChord({ ctrl: true, code: "Digit5" }, "win", "fr-azerty")).toBe("Ctrl+("));
  it("mac uses symbols in Apple order", () => expect(formatChord({ meta: true, shift: true, char: "b" }, "mac", "us")).toBe("⇧⌘B"));
  it("named keys", () => expect(formatChord({ ctrl: true, code: "ArrowDown" }, "win", "us")).toBe("Ctrl+↓"));
  it("F-keys", () => expect(formatChord({ code: "F4" }, "win", "us")).toBe("F4"));
});

describe("helpers", () => {
  it("rawId is stable", () => expect(rawId(raw({ code: "KeyB", ctrl: true, shift: true }))).toBe("ctrl+shift+KeyB"));
  it("detects modifier-only presses", () => {
    expect(isModifierOnly(raw({ code: "ShiftLeft" }))).toBe(true);
    expect(isModifierOnly(raw({ code: "KeyB" }))).toBe(false);
  });
});
