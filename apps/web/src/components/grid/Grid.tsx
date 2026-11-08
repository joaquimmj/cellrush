import { memo, useEffect, useRef } from "react";
import {
  DEFAULT_COL_WIDTH, colToLetters, displayText, getCell, inRange, rangeOf, selRange, toA1,
  type Dialog, type GridState, type Range, type Sheet,
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
            {Array.from({ length: sheet.rows }, (_, r) =>
              sheet.hiddenRows.includes(r) ? null : (
                <Row
                  key={r}
                  r={r}
                  sheet={sheet}
                  state={state}
                  inRowRange={r >= R.r1 && r <= R.r2}
                  activeRef={r === active.r ? activeRef : undefined}
                />
              ),
            )}
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

const DIALOG_OPTIONS: Record<Dialog["kind"], { title: string; options: [string, string, string][] }> = {
  pasteSpecial: {
    title: "Paste Special",
    options: [["all", "A", "All"], ["formulas", "F", "Formulas"], ["values", "V", "Values"], ["formats", "T", "Formats"]],
  },
  insert: { title: "Insert", options: [["row", "R", "Entire row"], ["col", "C", "Entire column"]] },
  delete: { title: "Delete", options: [["row", "R", "Entire row"], ["col", "C", "Entire column"]] },
};

function DialogBox({ dialog }: { dialog: Dialog }) {
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

const Row = memo(function Row({
  r, sheet, state, inRowRange, activeRef,
}: { r: number; sheet: Sheet; state: GridState; inRowRange: boolean; activeRef?: React.RefObject<HTMLTableCellElement> }) {
  const R = selRange(state.sel);
  const { active } = state.sel;
  const multi = R.r1 !== R.r2 || R.c1 !== R.c2;
  const p = state.editor?.point;
  const point = p ? rangeOf(p.anchor, p.focus) : null;
  const clip = state.clipboard && state.clipboard.sheetIndex === state.sheetIndex ? state.clipboard.range : null;
  return (
    <tr style={{ height: ROW_H }}>
      <th className={`sticky left-0 z-10 border border-line font-normal ${inRowRange ? "bg-line text-text" : "bg-panel text-sub"}`}>{r + 1}</th>
      {Array.from({ length: sheet.cols }, (_, c) => {
        const cell = getCell(sheet, { r, c });
        const isActive = active.r === r && active.c === c;
        const selected = multi && inRange(R, { r, c }) && !isActive;
        const f = cell?.format;
        const text = isActive && state.editor ? state.editor.text : displayText(cell, state.showFormulas, state.options.dateStyle);
        const numeric = typeof cell?.value === "number" && !(isActive && state.editor);
        const isErr = typeof cell?.value === "object" && cell?.value !== null;
        const pointed = point && inRange(point, { r, c });
        const ants = clip && inRange(clip, { r, c }) ? antsStyle(clip, r, c) : undefined;
        return (
          <td
            key={c}
            ref={isActive ? activeRef : undefined}
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
            style={{ color: f?.fontColor, background: f?.fillColor, ...ants }}
          >
            {isActive && state.editor ? <EditorText text={text} caret={state.editor.caret} /> : text}
          </td>
        );
      })}
    </tr>
  );
});

/** Dashed "marching ants" edges around the copied range. */
function antsStyle(R: Range, r: number, c: number): React.CSSProperties {
  const edge = "2px dashed var(--color-accent)";
  return {
    borderTop: r === R.r1 ? edge : undefined,
    borderBottom: r === R.r2 ? edge : undefined,
    borderLeft: c === R.c1 ? edge : undefined,
    borderRight: c === R.c2 ? edge : undefined,
  };
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
