import { colToLetters, createSheet, type GridState, type Range } from "@cellrush/engine";
import { R1, at, colRange, isReady, makeTable, rect, rowRange, selectionIs, stateOf, times } from "../data";
import { defineTask, type Task } from "../types";

type Sel = { want: Range; label?: string };
const selected = (st: GridState, p: Sel) => isReady(st) && selectionIs(st, p.want);

export const selectionTasks: Task[] = [
  defineTask<Sel>({
    id: "select-row",
    category: "selection",
    difficulty: 1,
    prompt: (p) => `Select the entire row ${p.want.r1 + 1}`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const a = at(rng.int(t.numbers.r1, t.numbers.r2), rng.int(t.range.c1, t.range.c2));
      return { state: stateOf(t.sheet, a, ctx), params: { want: rowRange(a.r) } };
    },
    check: selected,
    optimal: () => ({ win: ["shift+Space"], mac: ["shift+Space"] }),
    requires: ["select-row"],
  }),
  defineTask<Sel>({
    id: "select-column",
    category: "selection",
    difficulty: 1,
    prompt: (p) => `Select the entire column ${colToLetters(p.want.c1)}`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const a = at(rng.int(t.numbers.r1, t.numbers.r2), rng.int(t.range.c1, t.range.c2));
      return { state: stateOf(t.sheet, a, ctx), params: { want: colRange(a.c) } };
    },
    check: selected,
    optimal: () => ({ win: ["ctrl+Space"], mac: ["ctrl+Space"] }),
    requires: ["select-column"],
  }),
  defineTask<Sel>({
    id: "select-table",
    category: "selection",
    difficulty: 1,
    prompt: (p) => `Select the whole table (${R1(p.want)})`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const a = at(rng.int(t.numbers.r1, t.numbers.r2), rng.int(t.numbers.c1, t.numbers.c2));
      return { state: stateOf(t.sheet, a, ctx), params: { want: t.range } };
    },
    check: selected,
    optimal: () => ({ win: ["ctrl+a"], mac: ["meta+a"] }),
    requires: ["select-all"],
  }),
  defineTask<Sel>({
    id: "select-sheet",
    category: "selection",
    difficulty: 2,
    prompt: () => "Select the entire sheet",
    setup(rng, ctx) {
      const t = makeTable(rng);
      return { state: stateOf(t.sheet, t.origin, ctx), params: { want: rect(0, 0, 59, 25) } };
    },
    check: selected,
    optimal: () => ({ win: ["ctrl+a", "ctrl+a"], mac: ["meta+a", "meta+a"] }),
    requires: ["select-all"],
  }),
  defineTask<Sel>({
    id: "select-column-data",
    category: "selection",
    difficulty: 1,
    prompt: (p) => `Select the numbers ${R1(p.want)}`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const c = rng.int(t.numbers.c1, t.numbers.c2);
      return { state: stateOf(t.sheet, at(t.numbers.r1, c), ctx), params: { want: rect(t.numbers.r1, c, t.numbers.r2, c) } };
    },
    check: selected,
    optimal: () => ({ win: ["ctrl+shift+ArrowDown"], mac: ["meta+shift+ArrowDown"] }),
    requires: ["jump-extend-down"],
  }),
  defineTask<Sel>({
    id: "select-row-data",
    category: "selection",
    difficulty: 1,
    prompt: (p) => `Select the numbers ${R1(p.want)}`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const r = rng.int(t.numbers.r1, t.numbers.r2);
      return { state: stateOf(t.sheet, at(r, t.numbers.c1), ctx), params: { want: rect(r, t.numbers.c1, r, t.numbers.c2) } };
    },
    check: selected,
    optimal: () => ({ win: ["ctrl+shift+ArrowRight"], mac: ["meta+shift+ArrowRight"] }),
    requires: ["jump-extend-right"],
  }),
  defineTask<Sel>({
    id: "select-number-block",
    category: "selection",
    difficulty: 2,
    prompt: (p) => `Select all the numbers ${R1(p.want)}`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      return { state: stateOf(t.sheet, at(t.numbers.r1, t.numbers.c1), ctx), params: { want: t.numbers } };
    },
    check: selected,
    optimal: () => ({ win: ["ctrl+shift+ArrowDown", "ctrl+shift+ArrowRight"], mac: ["meta+shift+ArrowDown", "meta+shift+ArrowRight"] }),
    requires: ["jump-extend-down", "jump-extend-right"],
  }),
  defineTask<Sel & { n: number }>({
    id: "extend-cells",
    category: "selection",
    difficulty: 1,
    prompt: (p) => `Select ${R1(p.want)}`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const a = at(rng.int(t.numbers.r1, t.numbers.r2 - 3), rng.int(t.numbers.c1, t.numbers.c2));
      const n = rng.int(2, 3);
      return { state: stateOf(t.sheet, a, ctx), params: { want: rect(a.r, a.c, a.r + n, a.c), n } };
    },
    check: selected,
    optimal: (p) => ({ win: times(p.n, "shift+ArrowDown"), mac: times(p.n, "shift+ArrowDown") }),
    requires: ["extend-down"],
  }),
  defineTask<Sel>({
    id: "extend-to-last-cell",
    category: "selection",
    difficulty: 2,
    prompt: (p) => `Select from here to the last used cell (${R1(p.want)})`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      return { state: stateOf(t.sheet, t.origin, ctx), params: { want: t.range } };
    },
    check: selected,
    optimal: () => ({ win: ["ctrl+shift+End"], mac: ["ctrl+shift+End"] }),
    requires: ["extend-to-last-cell"],
  }),
  defineTask<Sel>({
    id: "extend-row-start",
    category: "selection",
    difficulty: 2,
    prompt: (p) => `Select back to the start of the row (${R1(p.want)})`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const a = at(rng.int(t.numbers.r1, t.numbers.r2), rng.int(Math.max(2, t.numbers.c1), t.numbers.c2));
      return { state: stateOf(t.sheet, a, ctx), params: { want: rect(a.r, 0, a.r, a.c) } };
    },
    check: selected,
    optimal: () => ({ win: ["shift+Home"], mac: ["shift+Home"] }),
    requires: ["extend-row-start"],
  }),
  defineTask<Sel & { n: number }>({
    id: "select-rows",
    category: "selection",
    difficulty: 2,
    prompt: (p) => `Select entire rows ${p.want.r1 + 1} to ${p.want.r2 + 1}`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const r = rng.int(t.numbers.r1, t.numbers.r2 - 2);
      const n = rng.int(1, 2);
      return { state: stateOf(t.sheet, at(r, t.range.c1), ctx), params: { want: rect(r, 0, r + n, 25), n } };
    },
    check: selected,
    optimal: (p) => ({ win: ["shift+Space", ...times(p.n, "shift+ArrowDown")], mac: ["shift+Space", ...times(p.n, "shift+ArrowDown")] }),
    requires: ["select-row", "extend-down"],
  }),
  defineTask<Sel & { n: number }>({
    id: "select-columns",
    category: "selection",
    difficulty: 2,
    prompt: (p) => `Select entire columns ${colToLetters(p.want.c1)} to ${colToLetters(p.want.c2)}`,
    setup(rng, ctx) {
      const t = makeTable(rng, { sheet: createSheet() });
      const c = rng.int(t.numbers.c1, t.numbers.c2 - 1);
      const n = rng.int(1, 2);
      return { state: stateOf(t.sheet, at(t.origin.r, c), ctx), params: { want: rect(0, c, 59, c + n), n } };
    },
    check: selected,
    optimal: (p) => ({ win: ["ctrl+Space", ...times(p.n, "shift+ArrowRight")], mac: ["ctrl+Space", ...times(p.n, "shift+ArrowRight")] }),
    requires: ["select-column", "extend-right"],
  }),
];
