import { describe, expect, it } from "vitest";
import { LAYOUTS, charForCode, codeForChar, guessLayout, type LayoutId } from "../src";

const ALL = Object.keys(LAYOUTS) as LayoutId[];

describe("layout tables", () => {
  it.each(ALL)("%s has every letter exactly once (unshifted)", (id) => {
    const bases = Object.values(LAYOUTS[id]).map((p) => p[0]);
    for (let c = 97; c <= 122; c++) {
      const ch = String.fromCharCode(c);
      expect(bases.filter((b) => b === ch), `${id} ${ch}`).toHaveLength(1);
    }
  });

  it.each(ALL)("%s maps every digit-row key", (id) => {
    for (let d = 0; d <= 9; d++) expect(charForCode(id, `Digit${d}`)).toBeDefined();
  });

  it.each(ALL)("%s digit row produces the digit (with or without shift)", (id) => {
    for (let d = 0; d <= 9; d++) {
      const [base, shifted] = LAYOUTS[id][`Digit${d}`]!;
      expect([base, shifted]).toContain(String(d));
    }
  });
});

describe("AZERTY", () => {
  it("swaps A/Q and Z/W, puts M on Semicolon", () => {
    expect(charForCode("fr-azerty", "KeyQ")).toBe("a");
    expect(charForCode("fr-azerty", "KeyA")).toBe("q");
    expect(charForCode("fr-azerty", "KeyW")).toBe("z");
    expect(charForCode("fr-azerty", "KeyZ")).toBe("w");
    expect(charForCode("fr-azerty", "Semicolon")).toBe("m");
  });
  it("digits need shift", () => {
    expect(charForCode("fr-azerty", "Digit5")).toBe("(");
    expect(charForCode("fr-azerty", "Digit5", true)).toBe("5");
    expect(codeForChar("fr-azerty", "5")).toEqual({ code: "Digit5", shift: true });
  });
});

describe("QWERTZ", () => {
  it("swaps Y/Z", () => {
    expect(charForCode("de-qwertz", "KeyY")).toBe("z");
    expect(charForCode("de-qwertz", "KeyZ")).toBe("y");
  });
  it("Shift+7 is slash", () => expect(charForCode("de-qwertz", "Digit7", true)).toBe("/"));
});

describe("UK", () => {
  it("Shift+2 is double quote, Shift+3 is pound", () => {
    expect(charForCode("uk", "Digit2", true)).toBe('"');
    expect(charForCode("uk", "Digit3", true)).toBe("£");
  });
});

describe("guessLayout", () => {
  it("detects AZERTY from a/q swap", () => {
    expect(guessLayout([{ code: "KeyQ", key: "a" }, { code: "Digit1", key: "&" }])).toBe("fr-azerty");
  });
  it("detects QWERTZ from y/z swap", () => {
    expect(guessLayout([{ code: "KeyY", key: "z" }, { code: "Minus", key: "ß" }])).toBe("de-qwertz");
  });
  it("detects US from plain keys", () => {
    expect(guessLayout([{ code: "KeyQ", key: "q" }, { code: "Digit2", key: "@" }])).toBe("us");
  });
  it("returns undefined without evidence", () => expect(guessLayout([])).toBeUndefined());
});
