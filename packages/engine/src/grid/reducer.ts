import { cycleAnchor, moveRewrite } from "../formula/refs";
import type { RefToken } from "../formula/tokenizer";
import { recalc } from "../formula/recalc";
import { cellsIn, inRange, rangeOf, rangeSize, rangeToA1, sameRange, toA1, type CellAddr, type Range } from "./address";
import { copyCellTo, paste, snapshot } from "./clipboard";
import { defaultDecimals, displayText, isoToDateText } from "./display";
import { currentRegion, jump, lastUsed, step, stepN, type Dir } from "./navigation";
import { createSheet, getCell, setCells } from "./sheet";
import {
  activeSheet, collapsed, selRange,
  type Action, type Dialog, type Editor, type GridState, type InsertChoice, type PasteMode, type Selection,
} from "./state";
import { insertLines } from "./structure";
import { PALETTE, type Cell, type CellFormat, type Sheet } from "./types";
import { hasFormat, makeCell } from "./value";

export { copyCellTo } from "./clipboard";

/** Pure reducer: (state, action) → new state. Never mutates its input. */
export function reduce(st: GridState, action: Action): GridState {
  if (st.dialog) return reduceDialog(st, action);
  return st.mode === "ready" ? reduceReady(st, action) : reduceEditing(st, action);
}

// ───────────────────────────── helpers ─────────────────────────────

interface MutateOpts {
  sel?: Selection;
  repeatable?: Action;
  sheetIndex?: number;
  keepClipboard?: boolean;
}

/** Record an undoable change (any sheets), recalculate, and return to ready mode. */
function mutate(st: GridState, sheetsIn: readonly Sheet[], o: MutateOpts = {}): GridState {
  const sel = o.sel ?? st.sel;
  const sheetIndex = o.sheetIndex ?? st.sheetIndex;
  const base: GridState = {
    ...st,
    mode: "ready",
    editor: null,
    dialog: null,
    sel,
    sheetIndex,
    lastAction: o.repeatable ?? st.lastAction,
    clipboard: o.keepClipboard ? st.clipboard : null,
  };
  if (sheetsIn === st.sheets && sheetIndex === st.sheetIndex) return base;
  const { sheets, circular } = recalc(sheetsIn);
  const patch = {
    before: st.sheets, after: sheets, indexBefore: st.sheetIndex, indexAfter: sheetIndex,
    selBefore: st.sel, selAfter: sel, circularBefore: st.circular, circularAfter: circular,
  };
  return { ...base, sheets, circular, undo: [...st.undo, patch].slice(-st.options.undoLimit), redo: [] };
}

const replaceActive = (st: GridState, sheet: Sheet) => st.sheets.map((s, i) => (i === st.sheetIndex ? sheet : s));
const mutateSheet = (st: GridState, sheet: Sheet, o: MutateOpts = {}) =>
  sheet === activeSheet(st) ? mutate(st, st.sheets, o) : mutate(st, replaceActive(st, sheet), o);

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
  const origin = st.sel.active;
  const bounds = { rows: sheet.rows, cols: sheet.cols };
  const writes: [CellAddr, Cell | undefined][] = [];
  const typed = text === "" ? undefined : makeCell(text, undefined, st.options.dateStyle);
  for (const a of targets) {
    const prev = getCell(sheet, a);
    if (!typed) {
      writes.push([a, prev && hasFormat(prev.format) ? { raw: "", value: null, format: prev.format } : undefined]);
      continue;
    }
    // Ctrl+Enter with a formula: each cell gets it shifted from the active cell, as in Excel.
    const moved = copyCellTo(typed, a.r - origin.r, a.c - origin.c, bounds)!;
    const fmt = { ...(prev?.format ?? {}) };
    if (typed.format.numberFormat && (!fmt.numberFormat || fmt.numberFormat === "general")) fmt.numberFormat = typed.format.numberFormat;
    writes.push([a, { ...moved, format: fmt }]);
  }
  return setCells(sheet, writes);
}

function setEditor(st: GridState, editor: Editor): GridState {
  return { ...st, editor };
}

function insertText(st: GridState, text: string): GridState {
  const ed = st.editor!;
  return setEditor(st, { text: ed.text.slice(0, ed.caret) + text + ed.text.slice(ed.caret), caret: ed.caret + text.length });
}

function startEditor(st: GridState, mode: "enter" | "edit", text: string, caret = text.length): GridState {
  return { ...st, mode, editor: { text, caret }, keytip: null };
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

/** Ctrl+Shift+& : a box around the selection (only the outer edges of each cell). */
function outline(sheet: Sheet, R: Range): Sheet {
  const writes: [CellAddr, Cell][] = [];
  for (const a of cellsIn(R)) {
    const prev = getCell(sheet, a);
    const edge = { top: a.r === R.r1, bottom: a.r === R.r2, left: a.c === R.c1, right: a.c === R.c2 };
    if (!edge.top && !edge.bottom && !edge.left && !edge.right) continue;
    const old = prev?.format.borders ?? {};
    const borders = {
      top: old.top || edge.top || undefined,
      bottom: old.bottom || edge.bottom || undefined,
      left: old.left || edge.left || undefined,
      right: old.right || edge.right || undefined,
    };
    const format = { ...(prev?.format ?? {}), borders };
    writes.push([a, prev ? { ...prev, format } : { raw: "", value: null, format }]);
  }
  return setCells(sheet, writes);
}

function fill(sheet: Sheet, R: Range, down: boolean): Sheet {
  const bounds = { rows: sheet.rows, cols: sheet.cols };
  const writes: [CellAddr, Cell | undefined][] = [];
  if (down) {
    const srcRow = R.r1 === R.r2 ? R.r1 - 1 : R.r1;
    if (srcRow < 0) return sheet;
    for (let c = R.c1; c <= R.c2; c++) {
      const src = getCell(sheet, { r: srcRow, c });
      for (let r = Math.max(R.r1, srcRow + 1); r <= R.r2; r++) writes.push([{ r, c }, copyCellTo(src, r - srcRow, 0, bounds)]);
    }
  } else {
    const srcCol = R.c1 === R.c2 ? R.c1 - 1 : R.c1;
    if (srcCol < 0) return sheet;
    for (let r = R.r1; r <= R.r2; r++) {
      const src = getCell(sheet, { r, c: srcCol });
      for (let c = Math.max(R.c1, srcCol + 1); c <= R.c2; c++) writes.push([{ r, c }, copyCellTo(src, 0, c - srcCol, bounds)]);
    }
  }
  return setCells(sheet, writes);
}

function navigate(st: GridState, target: (from: CellAddr) => CellAddr, extend?: boolean): GridState {
  if (extend) return { ...st, sel: { ...st.sel, focus: target(st.sel.focus) } };
  return { ...st, sel: collapsed(target(st.sel.active)) };
}

const isNumberAt = (sheet: Sheet, a: CellAddr) => typeof getCell(sheet, a)?.value === "number";

/** Alt+= : guess the block of numbers above (else to the left) and start =SUM(…). */
function autoSum(st: GridState): GridState {
  const sheet = activeSheet(st);
  const { r, c } = st.sel.active;
  let range: Range | null = null;
  if (r > 0 && isNumberAt(sheet, { r: r - 1, c })) {
    let top = r - 1;
    while (top > 0 && isNumberAt(sheet, { r: top - 1, c })) top--;
    range = { r1: top, c1: c, r2: r - 1, c2: c };
  } else if (c > 0 && isNumberAt(sheet, { r, c: c - 1 })) {
    let left = c - 1;
    while (left > 0 && isNumberAt(sheet, { r, c: left - 1 })) left--;
    range = { r1: r, c1: left, r2: r, c2: c - 1 };
  }
  if (!range) return startEditor(st, "enter", "=SUM()", 5);
  return startEditor(st, "enter", `=SUM(${rangeToA1(range)})`);
}

function doPaste(st: GridState, mode: PasteMode): GridState {
  const clip = st.clipboard;
  if (!clip) return { ...st, dialog: null };
  const sheet = activeSheet(st);
  const sameSheet = clip.sheetIndex === st.sheetIndex;
  const res = paste(sheet, clip, selRange(st.sel), mode, sameSheet);
  const sel: Selection = { active: { r: res.range.r1, c: res.range.c1 }, anchor: { r: res.range.r1, c: res.range.c1 }, focus: { r: res.range.r2, c: res.range.c2 } };
  let sheets = replaceActive(st, res.sheet);
  if (clip.cut && sameSheet) {
    // Formulas anywhere that pointed at the moved cells follow them (Excel's cut semantics).
    const dr = res.range.r1 - clip.range.r1;
    const dc = res.range.c1 - clip.range.c1;
    const name = sheet.name.toLowerCase();
    sheets = sheets.map((sh, i) => {
      const pointsAtSource = (ref: RefToken) => (ref.sheet === undefined ? i === st.sheetIndex : ref.sheet.toLowerCase() === name);
      let changed = false;
      const cells: Record<string, Cell> = {};
      for (const [k, c] of Object.entries(sh.cells)) {
        const raw = c.raw.startsWith("=") ? moveRewrite(c.raw, clip.range, dr, dc, pointsAtSource) : c.raw;
        if (raw !== c.raw) changed = true;
        cells[k] = raw === c.raw ? c : { ...c, raw };
      }
      return changed ? { ...sh, cells } : sh;
    });
  }
  // After a cut-paste the clipboard is spent; after a copy it stays for more pastes.
  return mutate(st, sheets, { sel, keepClipboard: !clip.cut });
}

function structural(st: GridState, axis: InsertChoice, insert: boolean): GridState {
  const sheet = activeSheet(st);
  const R = selRange(st.sel);
  const at = axis === "row" ? R.r1 : R.c1;
  const n = axis === "row" ? R.r2 - R.r1 + 1 : R.c2 - R.c1 + 1;
  const full = axis === "row" ? n >= sheet.rows : n >= sheet.cols;
  if (full) return { ...st, dialog: null };
  const sheets = insertLines(st.sheets, st.sheetIndex, axis, at, insert ? n : -n);
  return mutate(st, sheets, { repeatable: insert ? { type: "insertEntire", axis } : { type: "deleteEntire", axis } });
}

function isWholeRows(sheet: Sheet, R: Range) {
  return R.c1 === 0 && R.c2 === sheet.cols - 1;
}
function isWholeCols(sheet: Sheet, R: Range) {
  return R.r1 === 0 && R.r2 === sheet.rows - 1;
}

function nextSheetName(sheets: readonly Sheet[]): string {
  const taken = new Set(sheets.map((s) => s.name.toLowerCase()));
  let n = sheets.length + 1;
  while (taken.has(`sheet${n}`)) n++;
  return `Sheet${n}`;
}

// ───────────────────────────── dialogs ─────────────────────────────

const DIALOG_KEYS: Record<Exclude<Dialog["kind"], "color">, Record<string, string>> = {
  pasteSpecial: { a: "all", v: "values", f: "formulas", t: "formats" },
  insert: { r: "row", c: "col" },
  delete: { r: "row", c: "col" },
};

function reduceDialog(st: GridState, a: Action): GridState {
  const d = st.dialog!;
  switch (a.type) {
    case "cancel":
      return { ...st, dialog: null };
    case "dialogKey": {
      if (d.kind === "color") {
        const step = a.key === "ArrowRight" || a.key === "ArrowDown" ? 1 : a.key === "ArrowLeft" || a.key === "ArrowUp" ? -1 : 0;
        const index = Math.max(0, Math.min(PALETTE.length - 1, d.index + step));
        return { ...st, dialog: { ...d, index } };
      }
      const choice = DIALOG_KEYS[d.kind][a.key.toLowerCase()];
      return choice ? { ...st, dialog: { ...d, choice } as Dialog } : st;
    }
    case "dialogConfirm":
    case "commit": {
      const closed = { ...st, dialog: null };
      if (d.kind === "color") {
        const hex = PALETTE[d.index]!.hex;
        return reduceReady(closed, { type: "setFormat", patch: d.target === "font" ? { fontColor: hex } : { fillColor: hex } });
      }
      if (d.kind === "pasteSpecial") return doPaste(closed, d.choice);
      return structural(closed, d.choice, d.kind === "insert");
    }
    default:
      return st;
  }
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
    case "autoSum":
      return autoSum(st);
    case "commit":
      return { ...st, sel: moveWithin(sheet, st.sel, a.dir) };
    case "cancel":
      return st.clipboard ? { ...st, clipboard: null } : st;
    case "commitAll":
    case "newline":
    case "toggleAnchor":
    case "dialogKey":
    case "dialogConfirm":
      return st;
    case "deleteKey":
    case "clear": {
      const writes: [CellAddr, Cell | undefined][] = [];
      for (const p of cellsIn(R)) {
        const prev = getCell(sheet, p);
        if (prev) writes.push([p, hasFormat(prev.format) ? { raw: "", value: null, format: prev.format } : undefined]);
      }
      return mutateSheet(st, writes.length ? setCells(sheet, writes) : sheet, { repeatable: { type: "clear" }, keepClipboard: true });
    }
    case "fillDown":
    case "fillRight":
      return mutateSheet(st, fill(sheet, R, a.type === "fillDown"), { repeatable: a });
    case "toggleFormat": {
      const on = !getCell(sheet, st.sel.active)?.format[a.prop];
      return reduceReady(st, { type: "setFormat", patch: { [a.prop]: on } });
    }
    case "setFormat":
      return mutateSheet(st, applyFormat(sheet, R, (f) => ({ ...f, ...a.patch })), { repeatable: a, keepClipboard: true });
    case "numberFormat": {
      const patch: Partial<CellFormat> = { numberFormat: a.format, decimals: undefined };
      return mutateSheet(st, applyFormat(sheet, R, (f) => ({ ...f, ...patch })), { repeatable: a, keepClipboard: true });
    }
    case "decimals": {
      const act = getCell(sheet, st.sel.active);
      const base = act?.format.decimals ?? defaultDecimals(act?.format.numberFormat, act?.value);
      const dec = Math.max(0, Math.min(10, base + a.delta));
      return mutateSheet(st, applyFormat(sheet, R, (f) => ({ ...f, decimals: dec })), { repeatable: a, keepClipboard: true });
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
      return mutateSheet(st, { ...sheet, colWidths }, { repeatable: a, keepClipboard: true });
    }
    case "toggleShowFormulas":
      return { ...st, showFormulas: !st.showFormulas };
    case "colorDialog":
      // Starts on Automatic, like the top-left of Excel's palette.
      return { ...st, dialog: { kind: "color", target: a.target, index: 0 } };
    case "outlineBorder":
      return mutateSheet(st, outline(sheet, R), { repeatable: a, keepClipboard: true });
    case "removeBorders":
      return mutateSheet(st, applyFormat(sheet, R, (f) => ({ ...f, borders: undefined })), { repeatable: a, keepClipboard: true });
    case "copy":
    case "cut":
      return { ...st, clipboard: snapshot(sheet, st.sheetIndex, R, a.type === "cut") };
    case "paste":
      return doPaste(st, "all");
    case "pasteSpecialDialog":
      return st.clipboard && !st.clipboard.cut ? { ...st, dialog: { kind: "pasteSpecial", choice: "all" } } : st;
    case "pasteSpecial":
      return doPaste(st, a.mode);
    case "insertCells":
      if (isWholeRows(sheet, R)) return structural(st, "row", true);
      if (isWholeCols(sheet, R)) return structural(st, "col", true);
      return { ...st, dialog: { kind: "insert", choice: "row" } };
    case "deleteCells":
      if (isWholeRows(sheet, R)) return structural(st, "row", false);
      if (isWholeCols(sheet, R)) return structural(st, "col", false);
      return { ...st, dialog: { kind: "delete", choice: "row" } };
    case "insertEntire":
      return structural(st, a.axis, true);
    case "deleteEntire":
      return structural(st, a.axis, false);
    case "nextSheet":
      return st.sheetIndex < st.sheets.length - 1 ? { ...st, sheetIndex: st.sheetIndex + 1, sel: collapsed({ r: 0, c: 0 }) } : st;
    case "prevSheet":
      return st.sheetIndex > 0 ? { ...st, sheetIndex: st.sheetIndex - 1, sel: collapsed({ r: 0, c: 0 }) } : st;
    case "insertSheet": {
      const fresh = createSheet(nextSheetName(st.sheets), sheet.rows, sheet.cols);
      const sheets = [...st.sheets.slice(0, st.sheetIndex), fresh, ...st.sheets.slice(st.sheetIndex)];
      return mutate(st, sheets, { sel: collapsed({ r: 0, c: 0 }), sheetIndex: st.sheetIndex });
    }
    case "undo": {
      const p = st.undo[st.undo.length - 1];
      if (!p) return st;
      return {
        ...st, sheets: p.before, sheetIndex: p.indexBefore, sel: p.selBefore, circular: p.circularBefore,
        undo: st.undo.slice(0, -1), redo: [...st.redo, p], clipboard: null,
      };
    }
    case "redo": {
      const p = st.redo[st.redo.length - 1];
      if (!p) return st;
      return {
        ...st, sheets: p.after, sheetIndex: p.indexAfter, sel: p.selAfter, circular: p.circularAfter,
        redo: st.redo.slice(0, -1), undo: [...st.undo, p], clipboard: null,
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
  return mutateSheet(st, sheet, { sel });
}

const POINT_TRIGGERS = new Set(["=", "+", "-", "*", "/", "^", "&", "(", ",", "<", ">", ":"]);

/** In Enter mode, after "=" or an operator, arrows pick a cell into the formula (Excel's Point mode). */
function canPoint(st: GridState): boolean {
  const ed = st.editor!;
  if (st.mode !== "enter" || !ed.text.startsWith("=")) return false;
  if (ed.point && ed.caret === ed.point.end) return true;
  return POINT_TRIGGERS.has(ed.text[ed.caret - 1] ?? "");
}

function pointMove(st: GridState, a: Extract<Action, { type: "move" }>): GridState {
  const sheet = activeSheet(st);
  const ed = st.editor!;
  const go = (from: CellAddr) => (a.jump ? jump(sheet, from, a.dir) : step(sheet, from, a.dir));
  let anchor: CellAddr;
  let focus: CellAddr;
  let start: number;
  let end: number;
  if (ed.point && ed.caret === ed.point.end) {
    focus = go(ed.point.focus);
    anchor = a.extend ? ed.point.anchor : focus;
    ({ start, end } = ed.point);
  } else {
    focus = anchor = go(st.sel.active);
    start = end = ed.caret;
  }
  const ref = anchor.r === focus.r && anchor.c === focus.c ? toA1(focus) : rangeToA1(rangeOf(anchor, focus));
  const text = ed.text.slice(0, start) + ref + ed.text.slice(end);
  return setEditor(st, { text, caret: start + ref.length, point: { anchor, focus, start, end: start + ref.length } });
}

function reduceEditing(st0: GridState, a: Action): GridState {
  // Anything but another arrow ends Point mode.
  const st = a.type === "move" || !st0.editor!.point ? st0 : setEditor(st0, { text: st0.editor!.text, caret: st0.editor!.caret });
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
      return setEditor(st, { text: ed.text.slice(0, ed.caret - 1) + ed.text.slice(ed.caret), caret: ed.caret - 1 });
    case "deleteKey":
      return setEditor(st, { text: ed.text.slice(0, ed.caret) + ed.text.slice(ed.caret + 1), caret: ed.caret });
    case "home":
      return setEditor(st, { ...ed, caret: 0 });
    case "end":
      return setEditor(st, { ...ed, caret: ed.text.length });
    case "editCell":
      return { ...st, mode: st.mode === "edit" ? "enter" : "edit" };
    case "cancel":
      return { ...st, mode: "ready", editor: null };
    case "commit":
      return commitAndMove(st, a.dir);
    case "commitAll":
      return mutateSheet(st, writeEditor(st, cellsIn(selRange(st.sel))));
    case "repeat": // F4 while editing = toggle $ anchoring (Windows)
    case "toggleAnchor": {
      const res = cycleAnchor(ed.text, ed.caret);
      return res ? setEditor(st, res) : st;
    }
    case "move": {
      if (canPoint(st)) return pointMove(st, a);
      if (st.mode === "enter") {
        // Arrow keys in Enter mode commit, then move (Ctrl/Shift variants apply from the new cell).
        const committed = mutateSheet(st, writeEditor(st, [st.sel.active]));
        return reduceReady(committed, a);
      }
      if (a.dir === "left") return setEditor(st, { ...ed, caret: Math.max(0, ed.caret - 1) });
      if (a.dir === "right") return setEditor(st, { ...ed, caret: Math.min(ed.text.length, ed.caret + 1) });
      return st;
    }
    default:
      // Excel ignores most commands while a cell is being edited.
      return st;
  }
}
