import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { guessLayout, type LayoutId, type RawKey } from "@cellrush/engine";
import { runKey, strokeToRaws, tick, type RunState } from "@cellrush/drills";
import { toRaw } from "./browser-env";
import { click, useSettings } from "./settings";

declare global {
  interface Window {
    /** Dev/E2E hook: read-only view of the run, used by the Playwright bot. Not in production builds. */
    __cellrush?: { run: () => RunState; optimalKeys: () => RawKey[] | null };
    /** Dev/E2E only: ms from each keydown that changed the run to the DOM being updated. */
    __cellrushPerf?: number[];
  }
}

/** The current drill's optimal path as keydowns (for the E2E bot). */
function optimalKeys(run: RunState): RawKey[] | null {
  const cur = run.current;
  if (!cur || run.finishedAt !== null) return null;
  const path = cur.task.optimal(cur.params)[run.config.platform];
  return path ? path.flatMap((s) => strokeToRaws(s, run.config.layout)) : null;
}

interface Options {
  makeRun: () => RunState;
  layout: LayoutId;
  setLayout: (l: LayoutId) => void;
  /** Enter on a finished run starts a new one (default true). */
  restartOnEnter?: boolean;
}

/** Drives a run from real key presses: dispatch, clock, layout auto-detection, completion flash. */
export function useRun({ makeRun, layout, setLayout, restartOnEnter = true }: Options) {
  const [run, setRun] = useState<RunState>(makeRun);
  const runRef = useRef(run);
  runRef.current = run;
  const [now, setNow] = useState(() => performance.now());
  const [flash, setFlash] = useState(0);
  const samples = useRef<{ code: string; key: string }[]>([]);
  const { settings } = useSettings();
  const soundRef = useRef(settings.sound);
  soundRef.current = settings.sound;
  const measure = import.meta.env.DEV || !!import.meta.env.VITE_E2E;
  const keyAt = useRef<number | null>(null);

  // Latency probe (dev/E2E): keydown → engine → React render → DOM updated (layout effect).
  // Waiting for the next frame would add 0–16.7 ms of vsync alignment that is not our work.
  useLayoutEffect(() => {
    if (!measure || keyAt.current === null) return;
    (window.__cellrushPerf ??= []).push(performance.now() - keyAt.current);
    keyAt.current = null;
  }, [run, measure]);

  const restart = useCallback(() => setRun(makeRun()), [makeRun]);

  // A layout change (auto-detected from the first keys, or picked) applies to the run in progress.
  useEffect(() => {
    setRun((r) => (r.config.layout === layout ? r : { ...r, config: { ...r.config, layout } }));
  }, [layout]);

  useEffect(() => {
    if (import.meta.env.DEV || import.meta.env.VITE_E2E) {
      window.__cellrush = { run: () => runRef.current, optimalKeys: () => optimalKeys(runRef.current) };
    }
    return () => {
      delete window.__cellrush;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("select, button, textarea, input")) return;
      const cur = runRef.current;
      if (cur.finishedAt !== null) {
        if (restartOnEnter && e.key === "Enter") {
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
      const t0 = performance.now();
      const out = runKey(cur, raw, t0);
      if (measure && out.run !== cur) keyAt.current = t0;
      if (soundRef.current && out.handled) click(!!out.completed);
      // During a run every key belongs to the game, except browser keys it doesn't use (F12, F5…).
      if (out.handled || (raw.key.length === 1 && !raw.ctrl && !raw.meta)) e.preventDefault();
      if (out.completed) setFlash((f) => f + 1);
      if (out.run !== cur) setRun(out.run);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [layout, setLayout, restart, restartOnEnter]);

  // Background tabs throttle timers: re-check the clock as soon as the tab is visible again.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const next = tick(runRef.current, performance.now());
      if (next !== runRef.current) setRun(next);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

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

  return { run, setRun, now, flash, restart };
}
