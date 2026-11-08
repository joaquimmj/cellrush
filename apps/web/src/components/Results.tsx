import { resultSquare, scoreRun, taskById, type RunState, type ShareSummary } from "@cellrush/drills";
import { useT } from "../i18n";
import ShareBox from "./ShareBox";

interface Props {
  run: RunState;
  pb: { best: number; isNew: boolean } | null;
  onRestart: () => void;
  share?: ShareSummary;
  /** Server submission status (signed-in players). */
  status?: React.ReactNode;
  /** Replaces the "play again" line (the Daily has its own). */
  footer?: React.ReactNode;
}

const humanize = (id: string) => id.replace(/-/g, " ");
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export default function Results({ run, pb, onRestart, share, footer, status }: Props) {
  const t = useT();
  const s = scoreRun(run);
  const done = run.results.filter((r) => r.status === "done");
  const maxMs = Math.max(1, ...run.results.map((r) => r.ms));
  const W = 600;
  const H = 80;
  const bw = run.results.length ? W / run.results.length : W;

  return (
    <div className="space-y-8 py-6" data-testid="results">
      <div className="flex flex-wrap items-end gap-x-12 gap-y-4">
        <Stat label={t("res.score")} value={String(s.score)} big testId="score" />
        <Stat label={t("res.tpm")} value={s.tpm.toFixed(1)} />
        <Stat label={t("res.efficiency")} value={`${Math.round(s.efficiency * 100)}%`} testId="efficiency" />
        <Stat label={t("res.tasks")} value={`${s.completed}${s.skipped ? ` ${t("res.skipped", { n: s.skipped })}` : ""}`} testId="completed" />
        {pb && <Stat label={pb.isNew ? t("res.newPb") : t("res.pb")} value={String(pb.best)} accent={pb.isNew} />}
      </div>

      <div>
        <p className="mb-2 text-xs text-sub">{t("res.timePerTask")}</p>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-20 w-full" role="img" aria-label={t("res.chartLabel")}>
          {run.results.map((r, i) => {
            const h = Math.max(2, (r.ms / maxMs) * (H - 4));
            const color = r.status === "skipped" ? "var(--color-line)" : r.keystrokes <= r.optimal ? "var(--color-accent)" : "var(--color-warn)";
            return (
              <rect key={i} x={i * bw + 1} y={H - h} width={Math.max(1, bw - 2)} height={h} fill={color} rx={1}>
                <title>{`${humanize(r.taskId)} — ${secs(r.ms)}, ${r.keystrokes} keys (best ${r.optimal})`}</title>
              </rect>
            );
          })}
        </svg>
        <p className="mt-1 text-sm tracking-widest" aria-label={t("res.squaresLabel")}>{run.results.map(resultSquare).join("")}</p>
      </div>

      <div className="grid gap-6 text-sm sm:grid-cols-3">
        <div>
          <p className="mb-1 text-xs text-sub">{t("res.slowest")}</p>
          {s.slowest.length === 0 && <p className="text-sub">—</p>}
          <ol className="space-y-0.5">
            {s.slowest.map((r, i) => (
              <li key={i}>
                {humanize(r.taskId)} <span className="text-sub">{secs(r.ms)}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <p className="mb-1 text-xs text-sub">{t("res.consistency")}</p>
          <p>{done.length > 1 ? secs(s.consistencyMs) : "—"}</p>
        </div>
        <div>
          <p className="mb-1 text-xs text-sub">{t("res.undo")}</p>
          <p>{s.undoCount}</p>
        </div>
      </div>

      {s.slowest[0] && taskById(s.slowest[0].taskId) && (
        <p className="text-xs text-sub">
          {t("res.tip", { drill: humanize(s.slowest[0].taskId) })}
        </p>
      )}

      {status}
      {share && s.completed > 0 && <ShareBox summary={share} />}

      {footer ?? (
      <p className="text-center text-sm text-sub">
        <button className="rounded border border-line px-3 py-1 text-text hover:border-accent" onClick={onRestart}>
          {t("res.playAgain")}
        </button>{" "}
        {t("res.orPress")} <kbd className="text-text">Enter</kbd>
      </p>
      )}
    </div>
  );
}

function Stat({ label, value, big, accent, testId }: { label: string; value: string; big?: boolean; accent?: boolean; testId?: string }) {
  return (
    <div>
      <p className={`text-xs ${accent ? "text-accent" : "text-sub"}`}>{label}</p>
      <p data-testid={testId} className={`font-bold tabular-nums ${big ? "text-6xl text-accent" : "text-2xl"}`}>
        {value}
      </p>
    </div>
  );
}
