import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LAYOUT_NAMES, defaultPlatform, type LayoutId, type Platform, type ShortcutCategory } from "@cellrush/engine";
import { createRun, modeLabel, scoreRun, summarize, utcDate, type RunMode } from "@cellrush/drills";
import GameBoard from "../components/GameBoard";
import Results from "../components/Results";
import SubmitStatus from "../components/SubmitStatus";
import { currentEnv } from "../lib/browser-env";
import { loadPrefs, modeKey, personalBest, recordScore, releaseFocus, savePrefs } from "../lib/prefs";
import { useRun } from "../lib/useRun";
import { useT, type MessageKey } from "../i18n";

const MODES: { label: string; key: MessageKey; mode: RunMode }[] = [
  { label: "30s", key: "mode.30s", mode: { kind: "time", seconds: 30 } },
  { label: "60s", key: "mode.60s", mode: { kind: "time", seconds: 60 } },
  { label: "120s", key: "mode.120s", mode: { kind: "time", seconds: 120 } },
  { label: "25 tasks", key: "mode.25t", mode: { kind: "tasks", count: 25 } },
  { label: "50 tasks", key: "mode.50t", mode: { kind: "tasks", count: 50 } },
];
const CATEGORIES: ShortcutCategory[] = ["navigation", "selection", "editing", "formatting", "rows-cols", "clipboard", "formulas", "sheets", "ribbon"];

const sameMode = (a: RunMode, b: RunMode) => JSON.stringify(a) === JSON.stringify(b);
const parseMode = (s: string | null): RunMode | undefined => MODES.find((m) => m.label.replace(" tasks", "t") === s)?.mode;
const randomSeed = () => Math.floor(Math.random() * 2 ** 32);

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
  const [pb, setPb] = useState<{ best: number; isNew: boolean } | null>(null);
  const fixedSeed = search.get("seed");

  const makeRun = useCallback(
    () =>
      createRun({
        seed: fixedSeed ? Number(fixedSeed) : randomSeed(),
        mode, platform, layout, today: utcDate(Date.now()),
        categories: category === "all" ? undefined : [category],
      }),
    // A layout change mid-run is applied by useRun; it must not reshuffle the drills.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fixedSeed, mode, platform, category],
  );
  const { run, setRun, now, flash, restart } = useRun({ makeRun, layout, setLayout });

  // New settings → fresh run.
  useEffect(() => {
    setRun(makeRun());
    setPb(null);
  }, [makeRun, setRun]);

  useEffect(() => savePrefs({ platform, layout, mode }), [platform, layout, mode]);
  useEffect(() => {
    if (run.finishedAt === null) setPb(null);
  }, [run.finishedAt]);

  // Personal best, once per finished run.
  useEffect(() => {
    if (run.finishedAt === null || pb) return;
    const key = modeKey(run.config.mode, run.config.platform) + (category === "all" ? "" : `-${category}`);
    const best = personalBest(key);
    const s = scoreRun(run);
    const isNew = s.completed > 0 && recordScore(key, s.score);
    setPb({ best: Math.max(best, s.score), isNew });
  }, [run, pb, category]);

  if (env.mobile) {
    return <p className="py-20 text-center text-sub">This game needs a physical keyboard. Open it on a computer.</p>;
  }

  return (
    <section className="space-y-4 pb-8">
      <Settings
        mode={mode} setMode={setMode} platform={platform} setPlatform={setPlatform}
        layout={layout} setLayout={setLayout} category={category} setCategory={setCategory}
        onRestart={restart}
      />
      {run.finishedAt !== null ? (
        <Results run={run} pb={pb} onRestart={restart} status={<SubmitStatus run={run} daily={false} />} share={summarize(run, { daily: null, mode: modeLabel(run.config.mode) })} />
      ) : (
        <GameBoard run={run} now={now} flash={flash} />
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
  const t = useT();
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
            {t(m.key)}
          </button>
        ))}
      </div>
      <select aria-label={t("play.category")} className="rounded bg-bg px-2 py-1" value={p.category} onChange={(e) => p.setCategory(e.target.value as ShortcutCategory | "all")}>
        <option value="all">{t("play.allDrills")}</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>{t(`cat.${c}` as MessageKey)}</option>
        ))}
      </select>
      <select aria-label={t("play.platform")} className="rounded bg-bg px-2 py-1" value={p.platform} onChange={(e) => p.setPlatform(e.target.value as Platform)}>
        <option value="win">{t("platform.win")}</option>
        <option value="mac">{t("platform.mac")}</option>
      </select>
      <select aria-label={t("play.layout")} className="rounded bg-bg px-2 py-1" value={p.layout} onChange={(e) => p.setLayout(e.target.value as LayoutId)}>
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
        {t("play.restart")}
      </button>
    </div>
  );
}
