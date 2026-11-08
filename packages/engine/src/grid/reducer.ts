import { cellsIn, inRange, rangeSize, sameRange, type CellAddr, type Range } from "./address";
import { defaultDecimals, displayText, isoToDateText } from "./display";
import { currentRegion, jump, lastUsed, step, stepN, type Dir } from "./navigation";
import { getCell, setCells } from "./sheet";
import { activeSheet, collapsed, selRange, type Action, type GridState, type Selection } from "./state";
import type { Cell, CellFormat, Sheet } from "./types";
import { hasFormat, makeCell } from "./value";

/**
 * Copy a cell to an offset. Today an exact copy; the formula engine (M2) will shift
 * relative references here so fill / Ctrl+Enter behave like Excel.
 */
export function copyCellTo(cell: Cell | undefined, _dr: number, _dc: number): Cell | undefined {
  return cell ? { ...cell, format: { ...cell.format } } : undefined;
}

/** Pure reducer: (state, action) → new state. Never mutates its input. */
export function reduce(st: GridState, action: Action): GridState {
  return st.mode === "ready" ? reduceReady(st, action) : reduceEditing(st, action);
}

// ───────────────────────────── helpers ─────────────────────────────

function withSheet(st: GridState, sheet: Sheet): GridState["sheets"] {
  return st.sheets.map((s, i) => (i === st.sheetIndex ? sheet : s));
}

/** Record an undoable change and return to ready mode. */
function mutate(st: GridState, sheet: Sheet, sel: Selection = st.sel, repeatable?: Action): GridState {
  const before = activeSheet(st);
  const base = { ...st, mode: "ready" as const, editor: null, lastAction: repeatable ?? st.lastAction };
  if (sheet === before) return { ...base, sel };
  const patch = { sheetIndex: st.sheetIndex, before, after: sheet, selBefore: st.sel, selAfter: sel };
  return {
    ...base,
    sheets: withSheet(st, sheet),
    sel,
    undo: [...st.undo, patch].slice(-st.options.undoLimit),
    redo: [],
  };
}

function moveWithin(sheet: Sheet, sel: Selection, dir: Dir): Selection {
  const R = selRange(sel);
  if (rangeSize(R) === 1) return collapsed(step(sheet, sel.active, dir));
  let { r, c } = sel.active;
  const rows = R.r2 - R.r1 + 1;
  const cols = R.c2 - R.c1 + 1;
  // Walk the range like Excel: Enter goes down columns, Tab goes across rows, wrapping.
  let idx = dir === "up" || dir === "down" ? (c - R.c1) * rows + (r - R.r1) : (r - R.r1) * cols + (c - R.c1);
  const total = rows * cols;
  idx = (idx + (dir === "down" || dir === "right" ? 1 : -1) + total) % total;
  if (dir === "up" || dir === "down") {
    c = R.c1 + Math.floor(idx / rows);
    r = R.r1 + (idx % rows);
  } else {
    r = R.r1 + Math.floor(idx / cols);
    c = R.c1 + (idx % cols);
  }
  return { ...sel, active: { r, c } };
}

function writeEditor(st: GridState, targets: Iterable<CellAddr>): Sheet {
  const sheet = activeSheet(st);
  const text = st.editor?.text ?? "";
  const writes: [CellAddr, Cell | undefined][] = [];
  for (const a of targets) {
    const prev = getCell(sheet, a);
    if (text === "") writes.push([a, prev && hasFormat(prev.format) ? { raw: "", value: null, format: prev.format } : undefined]);
    else writes.push([a, makeCell(text, prev, st.options.dateStyle)]);
  }
  return setCells(sheet, writes);
}

function insertText(st: GridState, text: string): GridState {
  const ed = st.editor!;
  return { ...st, editor: { text: ed.text.slice(0, ed.caret) + text + ed.text.slice(ed.caret), caret: ed.caret + text.length } };
}

function startEditor(st: GridState, mode: "enter" | "edit", text: string): GridState {
  return { ...st, mode, editor: { text, caret: text.length }, keytip: null };
}

function applyFormat(sheet: Sheet, R: Range, fn: (f: CellFormat, cell: Cell | undefined) => CellFormat): Sheet {
  const writes: [CellAddr, Cell][] = [];
  for (const a of cellsIn(R)) {
    const prev = getCell(sheet, a);
    const format = fn(prev?.format ?? {}, prev);
    writes.push([a, prev ? { ...prev, format } : { raw: "", value: null, format }]);
  }
  return setCells(sheet, writes);
}

function fill(sheet: Sheet, R: Range, down: boolean): Sheet {
  const writes: [CellAddr, Cell | undefined][] = [];
  if (down) {
    const srcRow = R.r1 === R.r2 ? R.r1 - 1 : R.r1;
    if (srcRow < 0) return sheet;
    for (let c = R.c1; c <= R.c2; c++) {
      const src = getCell(sheet, { r: srcRow, c });
      for (let r = Math.max(R.r1, srcRow + 1); r <= R.r2; r++) writes.push([{ r, c }, copyCellTo(src, r - srcRow, 0)]);
    }
  } else {
    const srcCol = R.c1 === R.c2 ? R.c1 - 1 : R.c1;
    if (srcCol < 0) return sheet;
    for (let r = R.r1; r <= R.r2; r++) {
      const src = getCell(sheet, { r, c: srcCol });
      for (let c = Math.max(R.c1, srcCol + 1); c <= R.c2; c++) writes.push([{ r, c }, copyCellTo(src, 0, c - srcCol)]);
    }
  }
  return setCells(sheet, writes);
}

function navigate(st: GridState, target: (from: CellAddr) => CellAddr, extend?: boolean): GridState {
  if (extend) return { ...st, sel: { ...st.sel, focus: target(st.sel.focus) } };
  return { ...st, sel: collapsed(target(st.sel.active)) };
}

// ───────────────────────────── ready mode ─────────────────────────────

function reduceReady(st: GridState, a: Action): GridState {
  const sheet = activeSheet(st);
  const R = selRange(st.sel);
  switch (a.type) {
    case "move":
      return navigate(st, (from) => (a.jump ? jump(sheet, from, a.dir) : step(sheet, from, a.dir)), a.extend);
    case "home":
      return navigate(st, (from) => ({ r: from.r, c: 0 }), a.extend);
    case "end":
      return st;
    case "ctrlHome":
      return navigate(st, () => ({ r: 0, c: 0 }), a.extend);
    case "ctrlEnd":
      return navigate(st, () => lastUsed(sheet), a.extend);
    case "page":
      return navigate(st, (from) => stepN(sheet, from, a.dir, st.options.pageRows), a.extend);
    case "selectRow":
      return { ...st, sel: { ...st.sel, anchor: { r: R.r1, c: 0 }, focus: { r: R.r2, c: sheet.cols - 1 } } };
    case "selectColumn":
      return { ...st, sel: { ...st.sel, anchor: { r: 0, c: R.c1 }, focus: { r: sheet.rows - 1, c: R.c2 } } };
    case "selectAll": {
      const region = currentRegion(sheet, st.sel.active);
      const all: Range = { r1: 0, c1: 0, r2: sheet.rows - 1, c2: sheet.cols - 1 };
      const pick = rangeSize(region) === 1 || sameRange(region, R) ? all : region;
      return { ...st, sel: { ...st.sel, anchor: { r: pick.r1, c: pick.c1 }, focus: { r: pick.r2, c: pick.c2 } } };
    }
    case "input":
      return startEditor(st, "enter", a.text);
    case "backspace":
      return startEditor(st, "enter", "");
    case "editCell":
      return startEditor(st, "edit", getCell(sheet, st.sel.active)?.raw ?? "");
    case "insertDate":
      return startEditor(st, "enter", isoToDateText(st.options.today, st.options.dateStyle));
    case "copyFromAbove": {
      if (st.sel.active.r === 0) return st;
      return startEditor(st, "edit", getCell(sheet, { r: st.sel.active.r - 1, c: st.sel.active.c })?.raw ?? "");
    }
    case "commit":
      return { ...st, sel: moveWithin(sheet, st.sel, a.dir) };
    case "cancel":
    case "commitAll":
    case "newline":
      return st;
    case "deleteKey":
    case "clear": {
      const writes: [CellAddr, Cell | undefined][] = [];
      for (const p of cellsIn(R)) {
        const prev = getCell(sheet, p);
        if (prev) writes.push([p, hasFormat(prev.format) ? { raw: "", value: null, format: prev.format } : undefined]);
      }
      return mutate(st, writes.length ? setCells(sheet, writes) : sheet, st.sel, { type: "clear" });
    }
    case "fillDown":
    case "fillRight":
      return mutate(st, fill(sheet, R, a.type === "fillDown"), st.sel, a);
    case "toggleFormat": {
      const on = !getCell(sheet, st.sel.active)?.format[a.prop];
      return reduceReady(st, { type: "setFormat", patch: { [a.prop]: on } });
    }
    case "setFormat":
      return mutate(st, applyFormat(sheet, R, (f) => ({ ...f, ...a.patch })), st.sel, a);
    case "numberFormat": {
      const patch: Partial<CellFormat> = { numberFormat: a.format, decimals: undefined };
      return mutate(st, applyFormat(sheet, R, (f) => ({ ...f, ...patch })), st.sel, a);
    }
    case "decimals": {
      const act = getCell(sheet, st.sel.active);
      const base = act?.format.decimals ?? defaultDecimals(act?.format.numberFormat, act?.value);
      const dec = Math.max(0, Math.min(10, base + a.delta));
      return mutate(st, applyFormat(sheet, R, (f) => ({ ...f, decimals: dec })), st.sel, a);
    }
    case "autofitColumn": {
      const colWidths = { ...sheet.colWidths };
      for (let c = R.c1; c <= R.c2; c++) {
        let max = 0;
        for (let r = 0; r < sheet.rows; r++) {
          const len = displayText(getCell(sheet, { r, c }), st.showFormulas, st.options.dateStyle).length;
          if (len > max) max = len;
        }
        colWidths[c] = max === 0 ? 64 : Math.max(24, 12 + max * 7);
      }
      return mutate(st, { ...sheet, colWidths }, st.sel, a);
    }
    case "toggleShowFormulas":
      return { ...st, showFormulas: !st.showFormulas };
    case "undo": {
      const p = st.undo[st.undo.length - 1];
      if (!p) return st;
      return {
        ...st,
        sheets: st.sheets.map((s, i) => (i === p.sheetIndex ? p.before : s)),
        sheetIndex: p.sheetIndex,
        sel: p.selBefore,
        undo: st.undo.slice(0, -1),
        redo: [...st.redo, p],
      };
    }
    case "redo": {
      const p = st.redo[st.redo.length - 1];
      if (!p) return st;
      return {
        ...st,
        sheets: st.sheets.map((s, i) => (i === p.sheetIndex ? p.after : s)),
        sheetIndex: p.sheetIndex,
        sel: p.selAfter,
        redo: st.redo.slice(0, -1),
        undo: [...st.undo, p],
      };
    }
    case "repeat":
      return st.lastAction ? reduceReady(st, st.lastAction) : st;
    case "redoOrRepeat":
      return st.redo.length ? reduceReady(st, { type: "redo" }) : reduceReady(st, { type: "repeat" });
  }
}

// ───────────────────────────── enter / edit mode ─────────────────────────────

function commitAndMove(st: GridState, dir: Dir): GridState {
  const sheet = writeEditor(st, [st.sel.active]);
  const R = selRange(st.sel);
  const sel = rangeSize(R) > 1 && inRange(R, st.sel.active) ? moveWithin(sheet, st.sel, dir) : collapsed(step(sheet, st.sel.active, dir));
  return mutate(st, sheet, sel);
}

function reduceEditing(st: GridState, a: Action): GridState {
  const ed = st.editor!;
  switch (a.type) {
    case "input":
      return insertText(st, a.text);
    case "newline":
      return insertText(st, "\n");
    case "insertDate":
      return insertText(st, isoToDateText(st.options.today, st.options.dateStyle));
    case "copyFromAbove": {
      const { r, c } = st.sel.active;
      return r === 0 ? st : insertText(st, getCell(activeSheet(st), { r: r - 1, c })?.raw ?? "");
    }
    case "backspace":
      if (ed.caret === 0) return st;
      return { ...st, editor: { text: ed.text.slice(0, ed.caret - 1) + ed.text.slice(ed.caret), caret: ed.caret - 1 } };
    case "deleteKey":
      return { ...st, editor: { text: ed.text.slice(0, ed.caret) + ed.text.slice(ed.caret + 1), caret: ed.caret } };
    case "home":
      return { ...st, editor: { ...ed, caret: 0 } };
    case "end":
      return { ...st, editor: { ...ed, caret: ed.text.length } };
    case "editCell":
      return { ...st, mode: st.mode === "edit" ? "enter" : "edit" };
    case "cancel":
      return { ...st, mode: "ready", editor: null };
    case "commit":
      return commitAndMove(st, a.dir);
    case "commitAll":
      return mutate(st, writeEditor(st, cellsIn(selRange(st.sel))), st.sel);
    case "move": {
      if (st.mode === "enter") {
        // Arrow keys in Enter mode commit, then move (Ctrl/Shift variants apply from the new cell).
        const committed = mutate(st, writeEditor(st, [st.sel.active]), st.sel);
        return reduceReady(committed, a);
      }
      if (a.dir === "left") return { ...st, editor: { ...ed, caret: Math.max(0, ed.caret - 1) } };
      if (a.dir === "right") return { ...st, editor: { ...ed, caret: Math.min(ed.text.length, ed.caret + 1) } };
      return st;
    }
    default:
      // Excel ignores most commands while a cell is being edited.
      return st;
  }
}
