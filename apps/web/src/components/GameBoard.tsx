import { useEffect, useState } from "react";
import { scoreRun, type RunState } from "@cellrush/drills";
import { releaseFocus } from "../lib/prefs";
import Grid from "./grid/Grid";

interface Props {
  run: RunState;
  now: number;
  flash: number;
  /** Shown above the prompt, e.g. "Daily #12". */
  label?: string;
}

/** Prompt, clock and grid for a run in progress. */
export default function GameBoard({ run, now, flash, label }: Props) {
  const [toast, setToast] = useState(false);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 1200);
    return () => clearTimeout(t);
  }, [toast]);

  const live = scoreRun(run, now);
  const cur = run.current;
  const started = run.startedAt !== null;
  const mode = run.config.mode;
  const clock =
    mode.kind === "time"
      ? String(Math.ceil(Math.max(0, mode.seconds - (started ? (now - run.startedAt!) / 1000 : 0))))
      : `${run.results.length}/${mode.count}`;

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div className="min-h-16">
          <p className="text-xs tracking-wide text-sub uppercase">
            {label ? `${label} · ` : ""}
            {cur?.task.category}
          </p>
          <p className="text-xl font-bold sm:text-2xl" aria-live="polite" data-testid="prompt">
            {cur ? cur.task.prompt(cur.params) : "No drills match these filters."}
          </p>
        </div>
        <div className="text-right font-bold text-accent">
          <div className="text-3xl tabular-nums" data-testid="clock">{clock}</div>
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
      <p className="text-center text-xs text-sub">
        keyboard only · Shift+Esc skips a drill · {run.config.platform === "mac" ? "macOS" : "Windows"} shortcuts
      </p>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded border border-line bg-panel px-3 py-1 text-sm">keyboard only ⌨</div>
      )}
    </>
  );
}
