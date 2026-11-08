import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { defaultPlatform, type LayoutId, type Platform } from "@cellrush/engine";
import {
  DAILY_TASKS, createRun, dailyConfig, dailyNumber, msUntilNextDaily, summarize, utcDate, type ShareSummary,
} from "@cellrush/drills";
import GameBoard from "../components/GameBoard";
import Results from "../components/Results";
import ShareBox from "../components/ShareBox";
import { currentEnv } from "../lib/browser-env";
import { dailyAttempt, loadPrefs, releaseFocus, saveDailyAttempt } from "../lib/prefs";
import { useRun } from "../lib/useRun";

function Countdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = msUntilNextDaily(now);
  const hh = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
  const mm = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0");
  return (
    <p className="text-sm text-sub">
      next daily in <span className="text-text tabular-nums">{hh}:{mm}:{ss}</span>
    </p>
  );
}

export default function Daily() {
  const env = useMemo(currentEnv, []);
  const [search] = useSearchParams();
  const prefs = useMemo(loadPrefs, []);
  const platform: Platform = (search.get("platform") as Platform | null) ?? prefs.platform ?? defaultPlatform(env);
  const [layout, setLayout] = useState<LayoutId>(() => prefs.layout ?? "us");
  const date = useMemo(() => utcDate(Date.now()), []);
  const number = dailyNumber(date);
  const [ranked, setRanked] = useState<ShareSummary | null>(() => dailyAttempt(date, platform));
  // Already played today → show the ranked result until they choose to practise.
  const [playing, setPlaying] = useState(() => ranked === null);
  const [practice, setPractice] = useState(() => ranked !== null);
  const [summary, setSummary] = useState<ShareSummary | null>(null);

  const makeRun = useCallback(() => createRun(dailyConfig(date, platform, layout)), [date, platform]); // eslint-disable-line react-hooks/exhaustive-deps
  const { run, now, flash, restart } = useRun({ makeRun, layout, setLayout, restartOnEnter: false });

  useEffect(() => {
    if (run.finishedAt === null || summary) return;
    const s = summarize(run, { daily: number, mode: "daily" });
    setSummary(s);
    if (!practice && s.completed > 0 && saveDailyAttempt(s)) setRanked(s);
  }, [run, summary, practice, number]);

  const playAgain = () => {
    releaseFocus();
    setPractice(true);
    setSummary(null);
    setPlaying(true);
    restart();
  };

  if (env.mobile) return <p className="py-20 text-center text-sub">The daily needs a physical keyboard. Open it on a computer.</p>;

  const header = (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h1 className="text-2xl font-bold">
        Daily <span className="text-accent">#{number}</span>
        <span className="ml-3 text-sm font-normal text-sub">
          {date} · {DAILY_TASKS} drills · same for everyone on {platform === "mac" ? "Mac" : "Windows"}
        </span>
      </h1>
      <Countdown />
    </div>
  );

  if (!playing && ranked) {
    return (
      <section className="space-y-6 pb-8">
        {header}
        <p className="text-sm text-sub">You already played today's daily. Your ranked result:</p>
        <ShareBox summary={ranked} />
        <button className="rounded border border-line px-3 py-1 text-sm hover:border-text" onClick={playAgain}>
          practise it again (not ranked)
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4 pb-8">
      {header}
      {practice && <p className="text-xs text-warn">practice run, not ranked</p>}
      {run.finishedAt !== null && summary ? (
        <Results
          run={run}
          pb={null}
          onRestart={playAgain}
          share={practice ? undefined : summary}
          footer={
            <div className="space-y-3 text-center text-sm">
              {practice && ranked && (
                <p className="text-sub">
                  Your ranked result today is still <b className="text-text">{ranked.score}</b>.
                </p>
              )}
              <button className="rounded border border-line px-3 py-1 hover:border-text" onClick={playAgain}>
                practise again (not ranked)
              </button>
            </div>
          }
        />
      ) : (
        <GameBoard run={run} now={now} flash={flash} label={`daily #${number}`} />
      )}
    </section>
  );
}
