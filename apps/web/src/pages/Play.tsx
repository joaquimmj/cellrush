import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LAYOUT_NAMES, defaultPlatform, guessLayout, type LayoutId, type Platform, type RawKey, type ShortcutCategory,
} from "@cellrush/engine";
import { createRun, runKey, scoreRun, strokeToRaws, tick, type RunMode, type RunState } from "@cellrush/drills";
import Grid from "../components/grid/Grid";
import Results from "../components/Results";
import { currentEnv, toRaw } from "../lib/browser-env";
import { loadPrefs, modeKey, personalBest, recordScore, releaseFocus, savePrefs } from "../lib/prefs";

const MODES: { label: string; mode: RunMode }[] = [
  { label: "30s", mode: { kind: "time", seconds: 30 } },
  { label: "60s", mode: { kind: "time", seconds: 60 } },
  { label: "120s", mode: { kind: "time", seconds: 120 } },
  { label: "25 tasks", mode: { kind: "tasks", count: 25 } },
  { label: "50 tasks", mode: { kind: "tasks", count: 50 } },
];
const CATEGORIES: ShortcutCategory[] = ["navigation", "selection", "editing", "formatting", "rows-cols", "clipboard", "formulas", "sheets", "ribbon"];

const sameMode = (a: RunMode, b: RunMode) => JSON.stringify(a) === JSON.stringify(b);
const parseMode = (s: string | null): RunMode | undefined => MODES.find((m) => m.label.replace(" tasks", "t") === s)?.mode;
const today = () => new Date().toISOString().slice(0, 10);
const randomSeed = () => Math.floor(Math.random() * 2 ** 32);

declare global {
  interface Window {
    /** Dev/E2E hook: read-only view of the run, used by the Playwright bot. Not shipped in production builds. */
    __cellrush?: { run: () => RunState; optimalKeys: () => RawKey[] | null };
  }
}

/** The current drill's optimal path as keydowns (for the E2E bot). */
function optimalKeys(run: RunState): RawKey[] | null {
  const cur = run.current;
  if (!cur || run.finishedAt !== null) return null;
  const path = cur.task.optimal(cur.params)[run.config.platform];
  return path ? path.flatMap((s) => strokeToRaws(s, run.config.layout)) : null;
}

export default function Play() {
  const env = useMemo(currentEnv, []);
  const [search] = useSearchParams();
  const prefs = useMemo(loadPrefs, []);
  const [platform, setPlatform] = useState<Platform>(
    () => (search.get("platform") as Platform | null) ?? prefs.platform ?? defaultPlatform(env),
  );
  const [layout, setLayout] = useState<LayoutId>(() => prefs.layout ?? "us");
  const [mode, setMode] = useState<RunMode>(() => parseMode(search.get("mode")) ?? prefs.mode);
  const [category, setCategory] = useState<ShortcutCategory | "all">("all");
  const fixedSeed = search.get("seed");

  const makeRun = useCallback(
    () =>
      createRun({
        seed: fixedSeed ? Number(fixedSeed) : randomSeed(),
        mode, platform, layout, today: today(),
        categories: category === "all" ? undefined : [category],
      }),
    [fixedSeed, mode, platform, layout, category],
  );

  const [run, setRun] = useState<RunState>(makeRun);
  const runRef = useRef(run);
  runRef.current = run;
  const [now, setNow] = useState(() => performance.now());
  const [flash, setFlash] = useState(0);
  const [toast, setToast] = useState(false);
  const [pb, setPb] = useState<{ best: number; isNew: boolean } | null>(null);
  const samples = useRef<{ code: string; key: string }[]>([]);

  // New settings → fresh run (not mid-run layout guesses, which keep the same drills).
  useEffect(() => {
    setRun(makeRun());
    setPb(null);
    savePrefs({ platform, layout, mode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, platform, category]);

  // A layout change (auto-detected from the first keys, or picked) applies to the run in progress.
  useEffect(() => {
    setRun((r) => (r.config.layout === layout ? r : { ...r, config: { ...r.config, layout } }));
    savePrefs({ platform, layout, mode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  useEffect(() => {
    if (import.meta.env.DEV || import.meta.env.VITE_E2E) {
      window.__cellrush = { run: () => runRef.current, optimalKeys: () => optimalKeys(runRef.current) };
    }
    return () => {
      delete window.__cellrush;
    };
  }, []);

  const restart = useCallback(() => {
    setRun(makeRun());
    setPb(null);
  }, [makeRun]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("select, button")) return;
      const cur = runRef.current;
      if (cur.finishedAt !== null) {
        if (e.key === "Enter") {
          e.preventDefault();
          restart();
        }
        return;
      }
      const raw = toRaw(e);
      if (raw.key.length === 1 && !raw.ctrl && !raw.meta && !raw.alt) {
        samples.current = [...samples.current.slice(-20), { code: raw.code, key: raw.key }];
        const g = guessLayout(samples.current);
        if (g && g !== layout) setLayout(g);
      }
      const out = runKey(cur, raw, performance.now());
      // During a run every key belongs to the game, except plain browser keys it doesn't use (F12, F5…).
      if (out.handled || (raw.key.length === 1 && !raw.ctrl && !raw.meta)) e.preventDefault();
      if (out.completed) setFlash((f) => f + 1);
      if (out.run !== cur) setRun(out.run);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [layout, restart]);

  // Clock: drives the countdown and ends timed runs.
  useEffect(() => {
    if (run.startedAt === null || run.finishedAt !== null) return;
    const id = setInterval(() => {
      const t = performance.now();
      setNow(t);
      const next = tick(runRef.current, t);
      if (next !== runRef.current) setRun(next);
    }, 100);
    return () => clearInterval(id);
  }, [run.startedAt, run.finishedAt]);

  // Personal best, once per finished run.
  useEffect(() => {
    if (run.finishedAt === null || pb) return;
    const key = modeKey(run.config.mode, run.config.platform) + (category === "all" ? "" : `-${category}`);
    const best = personalBest(key);
    const s = scoreRun(run);
    const isNew = s.completed > 0 && recordScore(key, s.score);
    setPb({ best: Math.max(best, s.score), isNew });
  }, [run, pb, category]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 1200);
    return () => clearTimeout(t);
  }, [toast]);

  if (env.mobile) {
    return <p className="py-20 text-center text-sub">This game needs a physical keyboard. Open it on a computer.</p>;
  }

  const live = scoreRun(run, now);
  const cur = run.current;
  const started = run.startedAt !== null;
  const timeLeft =
    run.config.mode.kind === "time"
      ? Math.max(0, run.config.mode.seconds - (started ? (now - run.startedAt!) / 1000 : 0))
      : null;

  return (
    <section className="space-y-4 pb-8">
      <Settings
        mode={mode} setMode={setMode} platform={platform} setPlatform={setPlatform}
        layout={layout} setLayout={setLayout} category={category} setCategory={setCategory}
        onRestart={restart}
      />

      {run.finishedAt !== null ? (
        <Results run={run} pb={pb} onRestart={restart} />
      ) : (
        <>
          <div className="flex items-end justify-between gap-4">
            <div className="min-h-16">
              <p className="text-xs tracking-wide text-sub uppercase">{cur?.task.category}</p>
              <p className="text-xl font-bold sm:text-2xl" aria-live="polite" data-testid="prompt">
                {cur ? cur.task.prompt(cur.params) : "No drills match these filters."}
              </p>
            </div>
            <div className="text-right font-bold text-accent">
              <div className="text-3xl tabular-nums" data-testid="clock">
                {timeLeft !== null ? Math.ceil(timeLeft) : `${run.results.length}/${(run.config.mode as { count: number }).count}`}
              </div>
              <div className="text-xs font-normal text-sub">{started ? `${live.tpm.toFixed(1)} tasks/min` : "starts on your first key"}</div>
            </div>
          </div>
          {cur && (
            <div key={flash} className={flash ? "animate-[cellflash_400ms_ease-out]" : ""}>
              <Grid
                state={cur.state}
                onMouseAttempt={() => {
                  releaseFocus();
                  setToast(true);
                }}
              />
            </div>
          )}
          <p className="text-center text-xs text-sub">keyboard only · Shift+Esc skips a drill · {platform === "mac" ? "macOS" : "Windows"} shortcuts</p>
        </>
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded border border-line bg-panel px-3 py-1 text-sm">keyboard only ⌨</div>
      )}
    </section>
  );
}

interface SettingsProps {
  mode: RunMode;
  setMode: (m: RunMode) => void;
  platform: Platform;
  setPlatform: (p: Platform) => void;
  layout: LayoutId;
  setLayout: (l: LayoutId) => void;
  category: ShortcutCategory | "all";
  setCategory: (c: ShortcutCategory | "all") => void;
  onRestart: () => void;
}

function Settings(p: SettingsProps) {
  const btn = (active: boolean) => `px-2 py-1 rounded ${active ? "text-accent" : "text-sub hover:text-text"}`;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded bg-panel px-3 py-2 text-sm" onChange={releaseFocus}>
      <div className="flex">
        {MODES.map((m) => (
          <button
            key={m.label}
            className={btn(sameMode(m.mode, p.mode))}
            onClick={() => {
              p.setMode(m.mode);
              releaseFocus();
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <select aria-label="category" className="rounded bg-bg px-2 py-1" value={p.category} onChange={(e) => p.setCategory(e.target.value as ShortcutCategory | "all")}>
        <option value="all">all drills</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select aria-label="platform" className="rounded bg-bg px-2 py-1" value={p.platform} onChange={(e) => p.setPlatform(e.target.value as Platform)}>
        <option value="win">Windows</option>
        <option value="mac">macOS</option>
      </select>
      <select aria-label="keyboard layout" className="rounded bg-bg px-2 py-1" value={p.layout} onChange={(e) => p.setLayout(e.target.value as LayoutId)}>
        {(Object.keys(LAYOUT_NAMES) as LayoutId[]).map((l) => (
          <option key={l} value={l}>{LAYOUT_NAMES[l]}</option>
        ))}
      </select>
      <button
        className="rounded px-2 py-1 text-sub hover:text-text"
        onClick={() => {
          p.onRestart();
          releaseFocus();
        }}
      >
        ↻ restart
      </button>
    </div>
  );
}
