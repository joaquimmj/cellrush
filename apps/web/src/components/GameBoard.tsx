import { useEffect, useState } from "react";
import { promptText, scoreRun, timeLimitMs, type RunState } from "@cellrush/drills";
import { useT } from "../i18n";
import { useSettings } from "../lib/settings";
import { releaseFocus } from "../lib/prefs";
import Grid from "./grid/Grid";

interface Props {
  run: RunState;
  now: number;
  flash: number;
  /** Shown above the prompt, e.g. "Daily #12". */
  label?: string;
  /** Replaces the default prompt line (e.g. a scenario's live checklist). */
  promptExtra?: React.ReactNode;
  /** Shown under the prompt (e.g. a Learn-mode hint). */
  below?: React.ReactNode;
}

/** Prompt, clock and grid for a run in progress. */
export default function GameBoard({ run, now, flash, label, promptExtra, below }: Props) {
  const t = useT();
  const { settings } = useSettings();
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
  const limit = timeLimitMs(mode);
  const left = limit === null ? 0 : Math.max(0, limit / 1000 - (started ? (now - run.startedAt!) / 1000 : 0));
  const clock =
    mode.kind === "time" ? String(Math.ceil(left))
    : mode.kind === "scenario" ? `${Math.floor(Math.ceil(left) / 60)}:${String(Math.ceil(left) % 60).padStart(2, "0")}`
    : mode.kind === "tasks" ? `${run.results.length}/${mode.count}`
    : String(run.results.length);

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div className="min-h-16">
          <p className="text-xs tracking-wide text-sub uppercase">
            {label ? `${label} · ` : ""}
            {cur ? t(`cat.${cur.task.category}` as never) : ""}
          </p>
          <p className="text-xl font-bold sm:text-2xl" aria-live="polite" data-testid="prompt">
            {cur ? promptText(cur.task, cur.params, settings.lang) : t("board.noDrills")}
          </p>
          {promptExtra}
        </div>
        <div className="text-right font-bold text-accent">
          <div className="text-3xl tabular-nums" data-testid="clock">{clock}</div>
          <div className="text-xs font-normal text-sub">
            {!started ? t("board.startsOnKey") : mode.kind === "scenario" ? t("board.timeLeft") : mode.kind === "learn" ? t("board.drillsDone") : t("board.tpm", { n: live.tpm.toFixed(1) })}
          </div>
        </div>
      </div>
      {below}
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
        {t("board.footer", { platform: t(`platform.${run.config.platform}`) })}
      </p>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded border border-line bg-panel px-3 py-1 text-sm">{t("board.mouseToast")}</div>
      )}
    </>
  );
}
