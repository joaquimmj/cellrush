import { describe, expect, it } from "vitest";
import {
  LAYOUTS, MS_SHORTCUTS_URL, SHORTCUTS, bindingFor, displayText, dispatchKey, isKeytip, matchesChord, rawFromChord,
  type KeyChord, type LayoutId, type Platform, type RawKey,
} from "../src";
import { cell, grid, keys, raw, type } from "./helpers";

const k = (p: Partial<RawKey>): RawKey => ({ code: "", key: "", ctrl: false, shift: false, alt: false, meta: false, ...p });
const PLATFORMS: Platform[] = ["win", "mac"];
const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[];

describe("registry integrity", () => {
  it("ids are unique", () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every shortcut has a source and at least one platform", () => {
    for (const s of SHORTCUTS) {
      expect(s.source, s.id).toBe(MS_SHORTCUTS_URL);
      expect(s.win ?? s.mac, s.id).not.toBeNull();
    }
  });
  it("a platform marked verified has a binding", () => {
    for (const s of SHORTCUTS) for (const p of PLATFORMS) if (s.verified[p]) expect(bindingFor(s, p), `${s.id}/${p}`).not.toBeNull();
  });
  it("keytips are Windows-only", () => {
    for (const s of SHORTCUTS) expect(isKeytip(s.mac), s.id).toBe(false);
  });
  it.each(PLATFORMS.flatMap((p) => LAYOUT_IDS.map((l) => [p, l] as const)))("no two shortcuts share a chord (%s, %s)", (p, l) => {
    const seen = new Map<string, string>();
    for (const s of SHORTCUTS) {
      const b = bindingFor(s, p);
      if (!Array.isArray(b)) continue;
      for (const ch of b) {
        let rawKey: RawKey;
        try {
          rawKey = rawFromChord(ch, l);
        } catch {
          continue; // char not on this layout (e.g. ';' on QWERTZ without Shift)
        }
        const id = JSON.stringify(rawKey);
        expect(seen.get(id), `${s.id} clashes with ${seen.get(id)}`).toBeUndefined();
        seen.set(id, s.id);
      }
    }
  });
  it.each(PLATFORMS.flatMap((p) => LAYOUT_IDS.map((l) => [p, l] as const)))("every chord fires its own shortcut (%s, %s)", (p, l) => {
    const st = grid([["1", "2"], ["3", "4"]], "B2");
    for (const s of SHORTCUTS) {
      const b = bindingFor(s, p);
      if (!Array.isArray(b)) continue;
      for (const ch of b as KeyChord[]) {
        let rawKey: RawKey;
        try {
          rawKey = rawFromChord(ch, l);
        } catch {
          continue;
        }
        expect(matchesChord(ch, rawKey, l)).toBe(true);
        expect(dispatchKey(st, rawKey, { platform: p, layout: l }).shortcutId, `${s.id} ${JSON.stringify(ch)}`).toBe(s.id);
      }
    }
  });
});

describe("dispatch", () => {
  const ctx = { platform: "win" as const, layout: "us" as const };
  it("reports handled + shortcut id", () => {
    const r = dispatchKey(grid([]), k({ code: "KeyB", key: "b", ctrl: true }), ctx);
    expect(r).toMatchObject({ handled: true, shortcutId: "bold" });
  });
  it("unknown combos are not handled (browser keeps them)", () => {
    expect(dispatchKey(grid([]), k({ code: "F12", key: "F12" }), ctx).handled).toBe(false);
  });
  it("plain modifiers are ignored", () => expect(dispatchKey(grid([]), k({ code: "ShiftLeft", key: "Shift", shift: true }), ctx).handled).toBe(false));
  it("AZERTY: Ctrl + (key labelled A) selects all", () => {
    const st = keys(grid([["a", "b"]]), "ctrl+a", { layout: "fr-azerty" });
    expect(st.sel.focus).toEqual({ r: 0, c: 1 });
  });
  it("AZERTY: Ctrl+KeyA (labelled Q) is not select all", () => {
    const r = dispatchKey(grid([["a", "b"]]), k({ code: "KeyA", key: "q", ctrl: true }), { platform: "win", layout: "fr-azerty" });
    expect(r.shortcutId).toBeUndefined();
  });
  it("QWERTZ: Ctrl + (key labelled Z) undoes", () => {
    const st = keys(type(grid([]), "x"), "Enter, ctrl+z", { layout: "de-qwertz" });
    expect(raw(st, "A1")).toBe("");
  });
  it("Fn+Ctrl+Left on a Mac laptop acts as Ctrl+Home", () => {
    const r = dispatchKey(grid([], "C3"), k({ code: "ArrowLeft", key: "Home", ctrl: true }), { platform: "mac", layout: "us" });
    expect(r.shortcutId).toBe("go-home");
  });
  it("typing a digit starts entry", () => {
    const r = dispatchKey(grid([]), k({ code: "Digit5", key: "5" }), ctx);
    expect(r.state.editor?.text).toBe("5");
  });
  it("Mac Option characters can be typed into cells", () => {
    const r = dispatchKey(grid([]), k({ code: "KeyE", key: "€", alt: true }), { platform: "mac", layout: "us" });
    expect(r.state.editor?.text).toBe("€");
  });
});

describe("ribbon keytips (Windows)", () => {
  const alt = k({ code: "AltLeft", key: "Alt", alt: true });
  const ctx = { platform: "win" as const, layout: "us" as const };
  const tap = (st: ReturnType<typeof grid>, code: string, key: string) => dispatchKey(st, k({ code, key }), ctx).state;

  it("Alt starts keytip mode", () => expect(dispatchKey(grid([]), alt, ctx).state.keytip).toEqual([]));
  it("Alt, H, O, I autofits the column", () => {
    let st = dispatchKey(grid([["a very long label"]]), alt, ctx).state;
    st = tap(tap(tap(st, "KeyH", "h"), "KeyO", "o"), "KeyI", "i");
    expect(st.keytip).toBeNull();
    expect(st.sheets[0]!.colWidths[0]).toBeGreaterThan(64);
  });
  it("Alt, H, 0 adds a decimal", () => {
    let st = dispatchKey(grid([[1.5]]), alt, ctx).state;
    st = tap(tap(st, "KeyH", "h"), "Digit0", "0");
    expect(displayText(cell(st, "A1"))).toBe("1.50");
  });
  it("Alt, H, 9 removes a decimal", () => {
    let st = dispatchKey(grid([[1.25]]), alt, ctx).state;
    st = tap(tap(st, "KeyH", "h"), "Digit9", "9");
    expect(displayText(cell(st, "A1"))).toBe("1.3");
  });
  it("AZERTY digit keytips use the digit, not '&'", () => {
    const fr = { platform: "win" as const, layout: "fr-azerty" as const };
    let st = dispatchKey(grid([[1.5]]), alt, fr).state;
    st = dispatchKey(st, k({ code: "KeyH", key: "h" }), fr).state;
    st = dispatchKey(st, k({ code: "Digit0", key: "à" }), fr).state;
    expect(displayText(cell(st, "A1"))).toBe("1.50");
  });
  it("held Alt+H then O, I also works", () => {
    let st = dispatchKey(grid([["long text here"]]), k({ code: "KeyH", key: "h", alt: true }), ctx).state;
    expect(st.keytip).toEqual(["H"]);
    st = tap(tap(st, "KeyO", "o"), "KeyI", "i");
    expect(st.sheets[0]!.colWidths[0]).toBeGreaterThan(64);
  });
  it("a wrong key leaves keytip mode without typing", () => {
    let st = dispatchKey(grid([]), alt, ctx).state;
    st = tap(st, "KeyQ", "q");
    expect(st.keytip).toBeNull();
    expect(st.mode).toBe("ready");
  });
  it("Esc leaves keytip mode", () => {
    const st = dispatchKey(dispatchKey(grid([]), alt, ctx).state, k({ code: "Escape", key: "Escape" }), ctx).state;
    expect(st.keytip).toBeNull();
  });
  it("Alt+Enter still works as a chord while editing", () => {
    const st = keys(type(grid([]), "a"), "alt+Enter");
    expect(st.editor?.text).toBe("a\n");
  });
  it("Mac never enters keytip mode", () => {
    expect(dispatchKey(grid([]), alt, { platform: "mac", layout: "us" }).state.keytip).toBeNull();
  });
});
