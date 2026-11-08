import { memo, useEffect, useRef } from "react";
import {
  DEFAULT_COL_WIDTH, PALETTE, colToLetters, displayText, getCell, rangeOf, selRange, toA1,
  type Dialog, type GridState, type Sheet,
} from "@cellrush/engine";

const ROW_H = 24;
const HEADER_W = 40;

interface Props {
  state: GridState;
  onMouseAttempt?: () => void;
}

export default function Grid({ state, onMouseAttempt }: Props) {
  const sheet = state.sheets[state.sheetIndex]!;
  const R = selRange(state.sel);
  const active = state.sel.active;
  const activeRef = useRef<HTMLTableCellElement>(null);
  const editing = state.mode !== "ready";
  const activeCell = getCell(sheet, active);
  const barText = editing ? state.editor!.text : (activeCell?.raw ?? "");
  const multi = R.r1 !== R.r2 || R.c1 !== R.c2;
  const pt = state.editor?.point;
  const point = pt ? rangeOf(pt.anchor, pt.focus) : null;
  const clip = state.clipboard && state.clipboard.sheetIndex === state.sheetIndex ? state.clipboard.range : null;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active.r, active.c]);

  const block = (e: React.MouseEvent) => {
    e.preventDefault();
    onMouseAttempt?.();
  };

  return (
    <div className="select-none" onMouseDown={block}>
      <div className="mb-2 flex items-stretch gap-2 text-sm">
        <div className="w-20 rounded border border-line bg-panel px-2 py-1 text-center">{toA1(active)}</div>
        <div className="flex-1 truncate rounded border border-line bg-panel px-2 py-1 whitespace-pre">
          <span className="text-sub">ƒx </span>
          {editing ? <EditorText text={barText} caret={state.editor!.caret} /> : barText}
        </div>
      </div>
      <div className="max-h-[60vh] overflow-auto rounded border border-line">
        <table className="border-collapse text-[13px]" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: HEADER_W }} />
            {Array.from({ length: sheet.cols }, (_, c) => (
              <col key={c} style={{ width: sheet.colWidths[c] ?? DEFAULT_COL_WIDTH }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 border border-line bg-panel" />
              {Array.from({ length: sheet.cols }, (_, c) => (
                <th
                  key={c}
                  className={`sticky top-0 z-10 border border-line font-normal ${c >= R.c1 && c <= R.c2 ? "bg-line text-text" : "bg-panel text-sub"}`}
                  style={{ height: ROW_H }}
                >
                  {colToLetters(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sheet.rows }, (_, r) => {
              if (sheet.hiddenRows.includes(r)) return null;
              const inSel = multi && r >= R.r1 && r <= R.r2;
              const inPoint = point && r >= point.r1 && r <= point.r2;
              const inClip = clip && r >= clip.r1 && r <= clip.r2;
              const isActiveRow = r === active.r;
              return (
                <Row
                  key={r}
                  r={r}
                  sheet={sheet}
                  inRowRange={r >= R.r1 && r <= R.r2}
                  selC1={inSel ? R.c1 : -1}
                  selC2={inSel ? R.c2 : -1}
                  activeC={isActiveRow ? active.c : -1}
                  editorText={isActiveRow && state.editor ? state.editor.text : null}
                  caret={isActiveRow && state.editor ? state.editor.caret : 0}
                  pointC1={inPoint ? point.c1 : -1}
                  pointC2={inPoint ? point.c2 : -1}
                  clipC1={inClip ? clip.c1 : -1}
                  clipC2={inClip ? clip.c2 : -1}
                  clipTop={!!inClip && r === clip.r1}
                  clipBottom={!!inClip && r === clip.r2}
                  showFormulas={state.showFormulas}
                  dateStyle={state.options.dateStyle}
                  activeRef={isActiveRow ? activeRef : undefined}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs">
        {state.sheets.map((s, i) => (
          <span
            key={s.name}
            className={`rounded-b border border-t-0 px-3 py-0.5 ${i === state.sheetIndex ? "border-accent text-accent" : "border-line text-sub"}`}
          >
            {s.name}
          </span>
        ))}
        {state.circular.length > 0 && (
          <span className="ml-auto text-warn">⚠ circular reference: {state.circular.join(", ")}</span>
        )}
      </div>
      {state.dialog && <DialogBox dialog={state.dialog} />}
    </div>
  );
}

const DIALOG_OPTIONS: Record<Exclude<Dialog["kind"], "color">, { title: string; options: [string, string, string][] }> = {
  pasteSpecial: {
    title: "Paste Special",
    options: [["all", "A", "All"], ["formulas", "F", "Formulas"], ["values", "V", "Values"], ["formats", "T", "Formats"]],
  },
  insert: { title: "Insert", options: [["row", "R", "Entire row"], ["col", "C", "Entire column"]] },
  delete: { title: "Delete", options: [["row", "R", "Entire row"], ["col", "C", "Entire column"]] },
};

function DialogBox({ dialog }: { dialog: Dialog }) {
  if (dialog.kind === "color") return <PaletteBox dialog={dialog} />;
  const spec = DIALOG_OPTIONS[dialog.kind];
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
      <div role="dialog" aria-label={spec.title} className="w-64 rounded border border-line bg-panel p-4 text-sm shadow-xl">
        <h2 className="mb-3 font-bold">{spec.title}</h2>
        <ul className="space-y-1">
          {spec.options.map(([value, key, label]) => {
            // Underline the shortcut letter where it appears in the label ("Forma<u>t</u>s").
            const i = label.toLowerCase().indexOf(key.toLowerCase());
            return (
              <li key={value} className={dialog.choice === value ? "text-accent" : "text-sub"}>
                {dialog.choice === value ? "◉" : "○"} {label.slice(0, i)}
                <u>{label[i]}</u>
                {label.slice(i + 1)}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-sub">letter to pick · Enter to apply · Esc to cancel</p>
      </div>
    </div>
  );
}

interface RowProps {
  r: number;
  sheet: Sheet;
  inRowRange: boolean;
  /** Columns of a multi-cell selection on this row, or -1. */
  selC1: number;
  selC2: number;
  /** Active cell's column if it is on this row, or -1. */
  activeC: number;
  /** Editor text/caret when the active cell on this row is being edited. */
  editorText: string | null;
  caret: number;
  pointC1: number;
  pointC2: number;
  clipC1: number;
  clipC2: number;
  clipTop: boolean;
  clipBottom: boolean;
  showFormulas: boolean;
  dateStyle: "mdy" | "dmy";
  activeRef?: React.RefObject<HTMLTableCellElement>;
}

/**
 * One grid row. Props are primitives on purpose: React.memo then skips every row a keystroke
 * did not touch (moving the cursor re-renders 1–2 rows, not 60).
 */
const Row = memo(function Row(p: RowProps) {
  const { r, sheet } = p;
  return (
    <tr style={{ height: ROW_H }}>
      <th scope="row" className={`sticky left-0 z-10 border border-line font-normal ${p.inRowRange ? "bg-line text-text" : "bg-panel text-sub"}`}>{r + 1}</th>
      {Array.from({ length: sheet.cols }, (_, c) => {
        const cell = getCell(sheet, { r, c });
        const isActive = p.activeC === c;
        const editing = isActive && p.editorText !== null;
        const selected = c >= p.selC1 && c <= p.selC2 && p.selC1 >= 0 && !isActive;
        const f = cell?.format;
        const text = editing ? p.editorText! : displayText(cell, p.showFormulas, p.dateStyle);
        const numeric = typeof cell?.value === "number" && !editing;
        const isErr = typeof cell?.value === "object" && cell?.value !== null;
        const pointed = p.pointC1 >= 0 && c >= p.pointC1 && c <= p.pointC2;
        const inClip = p.clipC1 >= 0 && c >= p.clipC1 && c <= p.clipC2;
        const ants = inClip ? antsStyle(p.clipTop, p.clipBottom, c === p.clipC1, c === p.clipC2) : undefined;
        return (
          <td
            key={c}
            ref={isActive ? p.activeRef : undefined}
            aria-selected={isActive || selected || undefined}
            className={[
              "relative overflow-hidden border border-line/60 px-1 whitespace-nowrap",
              selected ? "bg-accent/15" : "",
              pointed ? "bg-sky-400/25 outline-1 -outline-offset-1 outline-sky-400" : "",
              isErr ? "text-bad" : "",
              isActive ? "outline-2 -outline-offset-1 outline-accent" : "",
              numeric ? "text-right" : "",
              f?.bold ? "font-bold" : "",
              f?.italic ? "italic" : "",
              f?.underline ? "underline" : "",
            ].join(" ")}
            style={{ color: f?.fontColor, background: f?.fillColor, ...bordersStyle(f?.borders), ...ants }}
          >
            {editing ? <EditorText text={text} caret={p.caret} /> : text}
          </td>
        );
      })}
    </tr>
  );
});

/** Cell borders drawn on top of the grid lines. */
function bordersStyle(b: { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean } | undefined): React.CSSProperties {
  if (!b) return {};
  const line = "2px solid var(--color-text)";
  return { borderTop: b.top ? line : undefined, borderRight: b.right ? line : undefined, borderBottom: b.bottom ? line : undefined, borderLeft: b.left ? line : undefined };
}

/** Simplified Standard Colors row (Alt, H, F, C / Alt, H, H): ← → to move, Enter to apply. */
function PaletteBox({ dialog }: { dialog: Extract<Dialog, { kind: "color" }> }) {
  const chosen = PALETTE[dialog.index]!;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
      <div role="dialog" aria-label={dialog.target === "font" ? "Font Color" : "Fill Color"} className="rounded border border-line bg-panel p-4 text-sm shadow-xl">
        <h2 className="mb-3 font-bold">{dialog.target === "font" ? "Font Color" : "Fill Color"}</h2>
        <div className="flex gap-1">
          {PALETTE.map((c, i) => (
            <span
              key={c.name}
              title={c.name}
              className={`h-6 w-6 rounded-sm border ${i === dialog.index ? "outline-2 outline-offset-2 outline-accent" : ""} ${c.hex ? "border-line" : "border-text"}`}
              style={{ background: c.hex ?? "transparent" }}
            >
              {!c.hex && <span className="block text-center text-[10px] leading-6">A</span>}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs" data-testid="palette-choice">{chosen.name}</p>
        <p className="mt-2 text-xs text-sub">← → to choose · Enter to apply · Esc to cancel</p>
      </div>
    </div>
  );
}

/** Dashed "marching ants" edges around the copied range. */
function antsStyle(top: boolean, bottom: boolean, left: boolean, right: boolean): React.CSSProperties {
  const edge = "2px dashed var(--color-accent)";
  return { borderTop: top ? edge : undefined, borderBottom: bottom ? edge : undefined, borderLeft: left ? edge : undefined, borderRight: right ? edge : undefined };
}

function EditorText({ text, caret }: { text: string; caret: number }) {
  return (
    <span className="whitespace-pre">
      {text.slice(0, caret)}
      <span className="inline-block h-[1.1em] w-px translate-y-[2px] animate-pulse bg-accent" />
      {text.slice(caret)}
    </span>
  );
}
