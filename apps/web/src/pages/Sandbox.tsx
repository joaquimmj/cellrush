import { useEffect, useMemo, useRef, useState } from "react";
import {
  LAYOUT_NAMES, createSheet, createState, defaultPlatform, dispatchKey, fillFromRows, formatChord, guessLayout,
  bindingFor, isKeytip, shortcutById, type GridState, type LayoutId, type Platform,
} from "@cellrush/engine";
import Grid from "../components/grid/Grid";
import { currentEnv, toRaw } from "../lib/browser-env";
import { releaseFocus } from "../lib/prefs";

// Synthetic sample data (made up for this demo).
const SAMPLE = [
  ["Northwind Labs", null, null, null, null],
  ["($k)", "FY23", "FY24", "FY25", "FY26"],
  ["Revenue", 1200, 1380, 1590, 1830],
  ["COGS", -480, -540, -610, -690],
  ["Gross profit", "=B3+B4", "=C3+C4", "=D3+D4", "=E3+E4"],
  ["Opex", -390, -420, -455, -490],
  ["EBITDA", "=B5+B6", "=C5+C6", "=D5+D6", "=E5+E6"],
  [null],
  ["Gross margin", "=B5/B3", "=C5/C3", "=D5/D3", "=E5/E3"],
];

const fresh = () =>
  createState({
    sheets: [fillFromRows(createSheet(), SAMPLE)],
    active: { r: 2, c: 1 },
    options: { today: new Date().toISOString().slice(0, 10) },
  });

export default function Sandbox() {
  const env = useMemo(currentEnv, []);
  const [platform, setPlatform] = useState<Platform>(() => defaultPlatform(env));
  const [layout, setLayout] = useState<LayoutId>("us");
  const [state, setState] = useState<GridState>(fresh);
  const [last, setLast] = useState<string>("");
  const [toast, setToast] = useState(false);
  const samples = useRef<{ code: string; key: string }[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("select, button")) return;
      const raw = toRaw(e);
      if (raw.key.length === 1 && !raw.ctrl && !raw.meta && !raw.alt) {
        samples.current = [...samples.current.slice(-20), { code: raw.code, key: raw.key }];
        const g = guessLayout(samples.current);
        if (g && g !== layout) setLayout(g);
      }
      const res = dispatchKey(stateRef.current, raw, { platform, layout });
      if (res.handled) e.preventDefault();
      if (res.state !== stateRef.current) setState(res.state);
      if (res.shortcutId) {
        const def = shortcutById(res.shortcutId)!;
        const b = bindingFor(def, platform);
        const label = isKeytip(b) ? `Alt, ${b.keytip.join(", ")}` : formatChord(b!.find(() => true)!, platform, layout);
        setLast(`${label} · ${res.shortcutId}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [platform, layout]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 1200);
    return () => clearTimeout(t);
  }, [toast]);

  if (env.mobile) return <p className="py-20 text-center text-sub">This needs a physical keyboard. Open it on a computer.</p>;

  const modeLabel = state.keytip !== null ? `Keytip: Alt${state.keytip.map((k) => `, ${k}`).join("")}…` : state.mode;

  return (
    <section className="space-y-3 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <h1 className="text-lg font-bold">Sandbox <span className="font-normal text-sub">— free practice, keyboard only</span></h1>
        {/* After a control is used, hand the keyboard back to the grid (the key handler ignores focused controls). */}
        <div className="flex items-center gap-2" onChange={releaseFocus}>
          <select className="rounded bg-panel px-2 py-1" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
            <option value="win">Windows</option>
            <option value="mac">macOS</option>
          </select>
          <select className="rounded bg-panel px-2 py-1" value={layout} onChange={(e) => setLayout(e.target.value as LayoutId)}>
            {(Object.keys(LAYOUT_NAMES) as LayoutId[]).map((l) => (
              <option key={l} value={l}>{LAYOUT_NAMES[l]}</option>
            ))}
          </select>
          <button className="rounded border border-line px-2 py-1 hover:border-text" onClick={() => {
              setState(fresh());
              releaseFocus();
            }}
          >
            reset
          </button>
        </div>
      </div>

      <Grid
        state={state}
        onMouseAttempt={() => {
          // Clicking the grid gives the keyboard back to it, even though the click itself is blocked.
          releaseFocus();
          setToast(true);
        }}
      />

      <div className="flex justify-between text-xs text-sub">
        <span>
          mode: <span className="text-text">{modeLabel}</span>
          {state.showFormulas && " · showing formulas"}
        </span>
        <span className="text-accent">{last}</span>
      </div>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded border border-line bg-panel px-3 py-1 text-sm">
          keyboard only ⌨
        </div>
      )}
    </section>
  );
}
