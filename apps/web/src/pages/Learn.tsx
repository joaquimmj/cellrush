import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { defaultPlatform, type LayoutId, type Platform, type ShortcutCategory } from "@cellrush/engine";
import {
  TASKS, createRun, describePath, learnPicker, masteredCount, recordOutcome, toReview, utcDate, type LearnBoxes,
} from "@cellrush/drills";
import GameBoard from "../components/GameBoard";
import { currentEnv } from "../lib/browser-env";
import { loadBoxes, loadPrefs, releaseFocus, saveBoxes } from "../lib/prefs";
import { useRun } from "../lib/useRun";

/** Seconds of hesitation before the hint appears. */
export const HINT_AFTER_MS = 4000;
const CATEGORIES: ShortcutCategory[] = ["navigation", "selection", "editing", "formatting", "rows-cols", "clipboard", "formulas", "sheets", "ribbon"];
const humanize = (id: string) => id.replace(/-/g, " ");

export default function Learn() {
  const env = useMemo(currentEnv, []);
  const [search] = useSearchParams();
  const prefs = useMemo(loadPrefs, []);
  const [platform, setPlatform] = useState<Platform>(() => (search.get("platform") as Platform | null) ?? prefs.platform ?? defaultPlatform(env));
  const [layout, setLayout] = useState<LayoutId>(() => prefs.layout ?? "us");
  const [category, setCategory] = useState<ShortcutCategory | "all">("all");
  const [boxes, setBoxes] = useState<LearnBoxes>(() => loadBoxes(platform));
  const boxesRef = useRef(boxes);
  boxesRef.current = boxes;

  const makeRun = useCallback(
    () =>
      createRun({
        seed: Number(search.get("seed") ?? Math.floor(Math.random() * 2 ** 32)),
        mode: { kind: "learn" }, platform, layout, today: utcDate(Date.now()),
        categories: category === "all" ? undefined : [category],
        pick: learnPicker(() => boxesRef.current),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [platform, category],
  );
  const { run, setRun, flash } = useRun({ makeRun, layout, setLayout, restartOnEnter: false });
  useEffect(() => {
    setRun(makeRun());
    setBoxes(loadBoxes(platform));
  }, [makeRun, setRun, platform]);

  // Our own clock: the hint must also appear before the first key.
  const [now, setNow] = useState(() => performance.now());
  const mountedAt = useRef(performance.now());
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, []);

  // When did the player last act on this drill?
  const cur = run.current;
  const lastEvent = run.events[run.events.length - 1];
  const drillStart = run.startedAt === null ? mountedAt.current : cur!.startedAt;
  const lastKey = run.startedAt !== null && lastEvent ? run.startedAt + lastEvent.t : 0;
  const idleSince = Math.max(drillStart, lastKey);
  const showHint = !!cur && now - idleSince >= HINT_AFTER_MS;

  // Remember which drills needed the hint, then grade each finished drill.
  const hinted = useRef(new Set<number>());
  if (showHint) hinted.current.add(run.index);
  const graded = useRef(0);
  useEffect(() => {
    if (run.results.length <= graded.current) return;
    let next = boxesRef.current;
    for (let i = graded.current; i < run.results.length; i++) {
      const r = run.results[i]!;
      next = recordOutcome(next, r.taskId, { hinted: hinted.current.has(i), skipped: r.status === "skipped", keystrokes: r.keystrokes, optimal: r.optimal });
    }
    graded.current = run.results.length;
    setBoxes(next);
    saveBoxes(platform, next);
  }, [run.results, platform]);
  useEffect(() => {
    graded.current = 0;
    hinted.current = new Set();
  }, [makeRun]);

  if (env.mobile) return <p className="py-20 text-center text-sub">Learn mode needs a physical keyboard.</p>;

  const path = cur ? cur.task.optimal(cur.params)[platform] : null;
  const review = toReview(boxes);
  const last = run.results[run.results.length - 1];
  const lastMissed = last && (last.status === "skipped" || last.keystrokes > last.optimal || hinted.current.has(run.results.length - 1));

  return (
    <section className="grid gap-6 pb-8 lg:grid-cols-[1fr_220px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded bg-panel px-3 py-2 text-sm" onChange={releaseFocus}>
          <span className="font-bold">Learn</span>
          <span className="text-sub">no timer · hint after {HINT_AFTER_MS / 1000}s · missed shortcuts come back</span>
          <select aria-label="category" className="ml-auto rounded bg-bg px-2 py-1" value={category} onChange={(e) => setCategory(e.target.value as ShortcutCategory | "all")}>
            <option value="all">all drills</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select aria-label="platform" className="rounded bg-bg px-2 py-1" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
            <option value="win">Windows</option>
            <option value="mac">macOS</option>
          </select>
        </div>
        <GameBoard
          run={run}
          now={now}
          flash={flash}
          label="learn"
          below={
            <div className="min-h-9 text-sm" aria-live="polite">
              {showHint && path ? (
                <p data-testid="hint" className="rounded border border-warn/50 bg-warn/10 px-3 py-1.5">
                  <span className="text-warn">hint:</span>{" "}
                  {describePath(path, platform, layout).map((k, i) => (
                    <span key={i}>
                      {i > 0 && <span className="text-sub"> then </span>}
                      <kbd className="font-bold">{k}</kbd>
                    </span>
                  ))}
                </p>
              ) : last ? (
                <p className={lastMissed ? "text-warn" : "text-accent"}>
                  {lastMissed ? `“${humanize(last.taskId)}” will come back soon.` : `✓ ${humanize(last.taskId)}: clean.`}
                </p>
              ) : (
                <p className="text-sub">Take your time. If you're stuck for {HINT_AFTER_MS / 1000} seconds, the keys appear here.</p>
              )}
            </div>
          }
        />
      </div>
      <aside className="space-y-4 text-sm">
        <div className="rounded border border-line p-3">
          <p className="text-xs text-sub">progress ({platform === "mac" ? "Mac" : "Windows"})</p>
          <p data-testid="mastered"><b className="text-accent">{masteredCount(boxes)}</b> / {TASKS.length} drills mastered</p>
          <p className="text-sub">{Object.keys(boxes).length} practised</p>
        </div>
        <div className="rounded border border-line p-3">
          <p className="mb-1 text-xs text-sub">to review</p>
          {review.length === 0 ? <p className="text-sub">nothing yet</p> : (
            <ul className="space-y-0.5" data-testid="review">
              {review.slice(0, 12).map((id) => <li key={id}>{humanize(id)}</li>)}
            </ul>
          )}
        </div>
      </aside>
    </section>
  );
}
