import type { LayoutId } from "./types";

/** [unshifted, shifted] character produced by a physical key. */
export type KeyPair = readonly [string, string];
export type LayoutTable = Readonly<Record<string, KeyPair>>;

const letters = (): Record<string, KeyPair> => {
  const out: Record<string, KeyPair> = {};
  for (let c = 65; c <= 90; c++) {
    const ch = String.fromCharCode(c);
    out[`Key${ch}`] = [ch.toLowerCase(), ch];
  }
  return out;
};

const US: LayoutTable = {
  ...letters(),
  Digit1: ["1", "!"], Digit2: ["2", "@"], Digit3: ["3", "#"], Digit4: ["4", "$"], Digit5: ["5", "%"],
  Digit6: ["6", "^"], Digit7: ["7", "&"], Digit8: ["8", "*"], Digit9: ["9", "("], Digit0: ["0", ")"],
  Minus: ["-", "_"], Equal: ["=", "+"], Backquote: ["`", "~"], BracketLeft: ["[", "{"],
  BracketRight: ["]", "}"], Backslash: ["\\", "|"], Semicolon: [";", ":"], Quote: ["'", '"'],
  Comma: [",", "<"], Period: [".", ">"], Slash: ["/", "?"],
};

const UK: LayoutTable = {
  ...US,
  Digit2: ["2", '"'], Digit3: ["3", "£"], Quote: ["'", "@"], Backslash: ["#", "~"],
  Backquote: ["`", "¬"], IntlBackslash: ["\\", "|"],
};

/** French AZERTY, Windows variant. macOS "French" differs on some symbol keys (see docs/KEYBOARD.md). */
const FR_AZERTY: LayoutTable = {
  ...letters(),
  KeyQ: ["a", "A"], KeyA: ["q", "Q"], KeyW: ["z", "Z"], KeyZ: ["w", "W"], Semicolon: ["m", "M"],
  Digit1: ["&", "1"], Digit2: ["é", "2"], Digit3: ['"', "3"], Digit4: ["'", "4"], Digit5: ["(", "5"],
  Digit6: ["-", "6"], Digit7: ["è", "7"], Digit8: ["_", "8"], Digit9: ["ç", "9"], Digit0: ["à", "0"],
  Minus: [")", "°"], Equal: ["=", "+"], Backquote: ["²", "²"], BracketLeft: ["^", "¨"],
  BracketRight: ["$", "£"], Backslash: ["*", "µ"], Quote: ["ù", "%"], KeyM: [",", "?"],
  Comma: [";", "."], Period: [":", "/"], Slash: ["!", "§"], IntlBackslash: ["<", ">"],
};

const DE_QWERTZ: LayoutTable = {
  ...letters(),
  KeyY: ["z", "Z"], KeyZ: ["y", "Y"],
  Digit1: ["1", "!"], Digit2: ["2", '"'], Digit3: ["3", "§"], Digit4: ["4", "$"], Digit5: ["5", "%"],
  Digit6: ["6", "&"], Digit7: ["7", "/"], Digit8: ["8", "("], Digit9: ["9", ")"], Digit0: ["0", "="],
  Minus: ["ß", "?"], Equal: ["´", "`"], Backquote: ["^", "°"], BracketLeft: ["ü", "Ü"],
  BracketRight: ["+", "*"], Backslash: ["#", "'"], Semicolon: ["ö", "Ö"], Quote: ["ä", "Ä"],
  Comma: [",", ";"], Period: [".", ":"], Slash: ["-", "_"], IntlBackslash: ["<", ">"],
};

export const LAYOUTS: Readonly<Record<LayoutId, LayoutTable>> = {
  us: US,
  uk: UK,
  "fr-azerty": FR_AZERTY,
  "de-qwertz": DE_QWERTZ,
};

export const LAYOUT_NAMES: Readonly<Record<LayoutId, string>> = {
  us: "US QWERTY",
  uk: "UK QWERTY",
  "fr-azerty": "Français AZERTY",
  "de-qwertz": "Deutsch QWERTZ",
};

/** Character a physical key produces on a layout, or undefined if the key is not in the table. */
export function charForCode(layout: LayoutId, code: string, shift = false): string | undefined {
  const pair = LAYOUTS[layout][code];
  return pair ? pair[shift ? 1 : 0] : undefined;
}

/** Physical key that produces `char` (unshifted first, then shifted). */
export function codeForChar(layout: LayoutId, char: string): { code: string; shift: boolean } | undefined {
  const table = LAYOUTS[layout];
  for (const [code, [base]] of Object.entries(table)) if (base === char) return { code, shift: false };
  for (const [code, [, shifted]] of Object.entries(table)) if (shifted === char) return { code, shift: true };
  return undefined;
}

/** Best guess of the layout from a few observed (code, key) pairs, e.g. from the first keypresses. */
export function guessLayout(samples: ReadonlyArray<{ code: string; key: string }>): LayoutId | undefined {
  let best: LayoutId | undefined;
  let bestScore = 0;
  for (const id of Object.keys(LAYOUTS) as LayoutId[]) {
    let score = 0;
    for (const s of samples) {
      const pair = LAYOUTS[id][s.code];
      if (pair && (pair[0] === s.key || pair[1] === s.key)) score++;
      else if (pair) score -= 1;
    }
    if (score > bestScore) { best = id; bestScore = score; }
  }
  return best;
}
