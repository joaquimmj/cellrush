import {
  createSheet, displayText, fillFromRows, type Cell, type GridState, type Platform, type Sheet,
} from "@cellrush/engine";
import { at, cellOf, company, everyCell, isReady, near, rawAt, rect, stateOf, times, valueAt } from "./data";
import type { OptimalPath, SetupContext, Task, TaskInstance } from "./types";
import type { Rng } from "./rng";

export interface Condition<P> {
  id: string;
  label: string;
  check(st: GridState, p: P): boolean;
  /** Only judged on these platforms (e.g. font colour has no Mac shortcut). Default: both. */
  platforms?: Platform[];
}

/** An "Analyst mode" speedrun: one sheet, several conditions, a checklist at the end. */
export interface Scenario<P extends { platform: Platform } = any> extends Task<P> {
  title: string;
  blurb: string;
  timeLimitS: number;
  conditions: Condition<P>[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  pass: boolean;
}

export function checklist<P extends { platform: Platform }>(s: Scenario<P>, st: GridState, p: P): ChecklistItem[] {
  return s.conditions
    .filter((c) => !c.platforms || c.platforms.includes(p.platform))
    .map((c) => ({ id: c.id, label: c.label, pass: c.check(st, p) }));
}

function defineScenario<P extends { platform: Platform }>(s: Omit<Scenario<P>, "check" | "prompt"> & { prompt?: (p: P) => string }): Scenario<P> {
  const sc: Scenario<P> = {
    ...s,
    prompt: s.prompt ?? (() => s.blurb),
    check: (st, p) => isReady(st) && checklist(sc, st, p).every((c) => c.pass),
  };
  return sc;
}

const withFormat = (sheet: Sheet, rows: number[], cols: number[], format: Cell["format"]): Sheet => {
  const cells = { ...sheet.cells };
  for (const r of rows) for (const c of cols) {
    const k = `${r}:${c}`;
    if (cells[k]) cells[k] = { ...cells[k]!, format: { ...cells[k]!.format, ...format } };
  }
  return { ...sheet, cells };
};

const BLUES = new Set(["#0070C0", "#0000FF", "#002060", "#00B0F0"]);
const isBlack = (c: Cell | undefined) => !c?.format.fontColor || c.format.fontColor === "#000000";
const COLS = [1, 2, 3, 4];

// ───────────────────────────── 1. P&L to banking standards ─────────────────────────────

type PnlP = { platform: Platform };
const INPUT_ROWS = [2, 3, 5];
const FORMULA_ROWS = [4, 6, 8, 9];
const TOTAL_ROWS = [4, 6];
const MARGIN_ROWS = [8, 9];

export const pnlScenario = defineScenario<PnlP>({
  id: "pnl-banking",
  title: "Format a P&L to banking standards",
  blurb: "Inputs blue, formulas black, margins in %, totals bold with a top border, negatives in parentheses.",
  category: "formatting",
  difficulty: 3,
  timeLimitS: 240,
  setup(rng: Rng, ctx: SetupContext): TaskInstance<PnlP> {
    const n = () => rng.int(900, 2000);
    const neg = (lo: number, hi: number) => -rng.int(lo, hi);
    let sheet = fillFromRows(createSheet(), [
      [`${company(rng)} ($k)`],
      ["", "FY23", "FY24", "FY25", "FY26"],
      ["Revenue", n(), n(), n(), n()],
      ["COGS", neg(300, 700), neg(300, 700), neg(300, 700), neg(300, 700)],
      ["Gross profit", "=B3+B4", "=C3+C4", "=D3+D4", "=E3+E4"],
      ["Opex", neg(150, 400), neg(150, 400), neg(150, 400), neg(150, 400)],
      ["EBITDA", "=B5+B6", "=C5+C6", "=D5+D6", "=E5+E6"],
      [],
      ["Gross margin", "=B5/B3", "=C5/C3", "=D5/D3", "=E5/E3"],
      ["EBITDA margin", "=B7/B3", "=C7/C3", "=D7/D3", "=E7/E3"],
    ]);
    // A junior coloured the formulas blue: the convention is the other way round.
    sheet = withFormat(sheet, FORMULA_ROWS, COLS, { fontColor: "#0070C0" });
    return { state: stateOf(sheet, at(2, 1), ctx), params: { platform: ctx.platform ?? "win" } };
  },
  conditions: [
    {
      id: "inputs-blue",
      label: "Hard-coded inputs (Revenue, COGS, Opex) in blue",
      platforms: ["win"],
      check: (st) => INPUT_ROWS.every((r) => COLS.every((c) => BLUES.has(cellOf(st, at(r, c))?.format.fontColor ?? ""))),
    },
    {
      id: "formulas-black",
      label: "Formulas in black",
      platforms: ["win"],
      check: (st) => FORMULA_ROWS.every((r) => COLS.every((c) => isBlack(cellOf(st, at(r, c))))),
    },
    {
      id: "margins-percent",
      label: "Margin rows formatted as %",
      check: (st) => MARGIN_ROWS.every((r) => COLS.every((c) => cellOf(st, at(r, c))?.format.numberFormat === "percent")),
    },
    {
      id: "totals-bold-border",
      label: "Gross profit and EBITDA bold with a top border",
      check: (st) => TOTAL_ROWS.every((r) => COLS.every((c) => !!cellOf(st, at(r, c))?.format.bold && !!cellOf(st, at(r, c))?.format.borders?.top)),
    },
    {
      id: "negatives-parens",
      label: "Negative numbers shown in parentheses",
      check: (st) =>
        everyCell(rect(2, 1, 6, 4), (a) => {
          const v = valueAt(st, a);
          return typeof v !== "number" || v >= 0 || displayText(cellOf(st, a)).startsWith("(");
        }),
    },
  ],
  optimal: (): OptimalPath => {
    const blue = ["AltLeft", "h", "f", "c", ...times(8, "ArrowRight"), "Enter"];
    const black = ["AltLeft", "h", "f", "c", "Enter"];
    return {
      win: [
        // Inputs → blue (F4 repeats the colour on Opex)
        "shift+ArrowDown", "ctrl+shift+ArrowRight", ...blue,
        ...times(3, "ArrowDown"), "ctrl+shift+ArrowRight", "F4",
        // Formulas → black, then margins → %
        "ArrowUp", "ctrl+shift+ArrowRight", ...black,
        ...times(2, "ArrowDown"), "ctrl+shift+ArrowRight", "F4",
        ...times(2, "ArrowDown"), "shift+ArrowDown", "ctrl+shift+ArrowRight", "F4", "ctrl+shift+Digit5",
        // Totals: bold + box
        ...times(4, "ArrowUp"), "ctrl+shift+ArrowRight", "ctrl+b", "ctrl+shift+Digit7",
        ...times(2, "ArrowDown"), "ctrl+shift+ArrowRight", "ctrl+b", "ctrl+shift+Digit7",
        // Negatives in parentheses (currency format)
        ...times(4, "ArrowUp"), ...times(4, "shift+ArrowDown"), "ctrl+shift+ArrowRight", "ctrl+shift+Digit4",
      ],
      // Mac: no font-colour shortcut exists, so those two conditions are Windows-only.
      mac: [
        ...times(6, "ArrowDown"), "shift+ArrowDown", "meta+shift+ArrowRight", "ctrl+shift+Digit5",
        ...times(4, "ArrowUp"), "meta+shift+ArrowRight", "meta+b", "meta+alt+Digit0",
        ...times(2, "ArrowDown"), "meta+shift+ArrowRight", "meta+b", "meta+alt+Digit0",
        ...times(4, "ArrowUp"), ...times(4, "shift+ArrowDown"), "meta+shift+ArrowRight", "ctrl+shift+Digit4",
      ],
    };
  },
  requires: ["font-color", "repeat", "format-percent", "bold", "outline-border", "format-currency"],
});

// ───────────────────────────── 2. Revenue projection ─────────────────────────────

type ProjP = { platform: Platform; rate: number };
const PROJ = rect(3, 2, 4, 5); // C4:F5

export const projectionScenario = defineScenario<ProjP>({
  id: "revenue-projection",
  title: "Build a revenue projection",
  blurb: "Grow both segments to FY28 with the rate in B1 (anchored), then total every year.",
  prompt: (p) => `Grow both segments to FY28 at ${Math.round(p.rate * 100)}% (B1, anchored), then total every year in row 6.`,
  category: "formulas",
  difficulty: 3,
  timeLimitS: 180,
  setup(rng, ctx) {
    const rate = rng.int(3, 12) / 100;
    let sheet = fillFromRows(createSheet(), [
      ["Growth", rate],
      [],
      ["($k)", "FY24", "FY25", "FY26", "FY27", "FY28"],
      ["Segment A", rng.int(400, 1500)],
      ["Segment B", rng.int(400, 1500)],
      ["Total"],
    ]);
    sheet = withFormat(sheet, [0], [1], { numberFormat: "percent" });
    return { state: stateOf(sheet, at(3, 2), ctx), params: { platform: ctx.platform ?? "win", rate } };
  },
  conditions: [
    {
      id: "growth-formulas",
      label: "FY25–FY28 grow from the previous year (C4:F5)",
      check: (st, p) => everyCell(PROJ, (a) => rawAt(st, a).startsWith("=") && near(valueAt(st, a), Number(valueAt(st, at(a.r, a.c - 1))) * (1 + p.rate))),
    },
    {
      id: "rate-anchored",
      label: "Every growth formula uses the anchored rate $B$1",
      check: (st) => everyCell(PROJ, (a) => rawAt(st, a).toUpperCase().includes("$B$1")),
    },
    {
      id: "totals",
      label: "Row 6 totals each year with a formula (B6:F6)",
      check: (st) => everyCell(rect(5, 1, 5, 5), (a) => rawAt(st, a).startsWith("=") && near(valueAt(st, a), Number(valueAt(st, at(3, a.c))) + Number(valueAt(st, at(4, a.c))))),
    },
  ],
  optimal: () => {
    const build = (anchor: string, fill: string, autosum: string) => [
      "shift+ArrowDown", ...times(3, "shift+ArrowRight"),
      "type:=", "ArrowLeft", "type:*(1+", ...times(3, "ArrowUp"), "ArrowLeft", anchor, "type:)", fill,
      "ArrowDown", "ArrowDown", "ArrowLeft", ...times(4, "shift+ArrowRight"), autosum, fill,
    ];
    return { win: build("F4", "ctrl+Enter", "alt+Equal"), mac: build("F4", "meta+Enter", "meta+shift+t") };
  },
  requires: ["fill-selection", "autosum", "repeat", "toggle-anchor"],
});

// ───────────────────────────── 3. Clean a data dump ─────────────────────────────

type CleanP = { platform: Platform; n: number; blanks: [number, number]; vat: Record<string, number>; widthNeeded: number };

export const cleanScenario = defineScenario<CleanP>({
  id: "clean-data",
  title: "Clean a data dump",
  blurb: "Delete the blank rows, autofit the Client column, and turn the VAT formulas into values.",
  category: "rows-cols",
  difficulty: 3,
  timeLimitS: 180,
  setup(rng, ctx) {
    const n = rng.int(6, 8);
    const vat: Record<string, number> = {};
    const data: (string | number)[][] = [];
    const names = new Set<string>();
    while (names.size < n) names.add(`${company(rng)} — ${rng.pick(["Paris", "Lyon", "London", "Geneva", "Brussels", "Milan"])}`);
    for (const client of names) {
      const amount = rng.int(100, 9000);
      vat[client] = amount * 0.2;
      data.push([`2026-${String(rng.int(1, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`, client, amount]);
    }
    // Sheet rows: header at 0, data below with two blank rows (not adjacent, not first/last).
    const b1 = rng.int(2, n - 2);
    const b2 = rng.int(b1 + 2, n);
    const rows: (string | number | null)[][] = [["Date", "Client", "Amount", "VAT"]];
    let d = 0;
    for (let r = 1; d < n; r++) {
      if (r === b1 || r === b2) rows.push([]);
      else {
        const row = data[d++]!;
        rows.push([row[0]!, row[1]!, row[2]!, `=C${r + 1}*0.2`]);
      }
    }
    const longest = Math.max(...[...names, "Client"].map((s) => s.length));
    return {
      state: stateOf(fillFromRows(createSheet(), rows), at(0, 0), ctx),
      params: { platform: ctx.platform ?? "win", n, blanks: [b1, b2], vat, widthNeeded: 12 + longest * 7 },
    };
  },
  conditions: [
    {
      id: "no-blank-rows",
      label: "No blank rows left inside the data, nothing lost",
      check: (st, p) => {
        for (let r = 1; r <= p.n; r++) if (rawAt(st, at(r, 1)) === "") return false;
        return rawAt(st, at(p.n + 1, 1)) === "" && rawAt(st, at(p.n + 2, 1)) === "";
      },
    },
    {
      id: "client-autofit",
      label: "Client column wide enough for every name (autofit)",
      platforms: ["win"],
      check: (st, p) => (st.sheets[st.sheetIndex]!.colWidths[1] ?? 64) >= p.widthNeeded,
    },
    {
      id: "vat-values",
      label: "VAT column holds values, not formulas, and they are right",
      check: (st, p) => {
        let seen = 0;
        for (let r = 1; r <= p.n + 2; r++) {
          const client = rawAt(st, at(r, 1));
          if (!client) continue;
          seen++;
          if (rawAt(st, at(r, 3)).startsWith("=") || !near(valueAt(st, at(r, 3)), p.vat[client] ?? NaN)) return false;
        }
        return seen === p.n;
      },
    },
  ],
  optimal: (p) => {
    const [b1, b2] = p.blanks;
    const deleteBlanks = [...times(b1, "ArrowDown"), "shift+Space", "ctrl+Minus", ...times(b2 - 1 - b1, "ArrowDown"), "shift+Space", "ctrl+Minus"];
    const toVat = ["ctrl+Home", "ArrowDown", ...times(3, "ArrowRight")];
    return {
      win: [...deleteBlanks, "ArrowRight", "AltLeft", "h", "o", "i", ...toVat, "ctrl+shift+ArrowDown", "ctrl+c", "ctrl+alt+v", "v", "Enter"],
      // Mac: no autofit shortcut, so that condition is Windows-only.
      mac: [...deleteBlanks, ...toVat, "meta+shift+ArrowDown", "meta+c", "meta+ctrl+v", "v", "Enter"],
    };
  },
  requires: ["select-row", "delete-cells", "autofit-column", "jump-extend-down", "copy", "paste-special"],
});

export const SCENARIOS: readonly Scenario[] = [pnlScenario, projectionScenario, cleanScenario];
export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id);
