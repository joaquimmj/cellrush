import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { defaultPlatform, type LayoutId, type Platform } from "@cellrush/engine";
import { SCENARIOS, checklist, createRun, mulberry32, scoreRun, utcDate, type RunState, type Scenario } from "@cellrush/drills";
import GameBoard from "../components/GameBoard";
import SubmitStatus from "../components/SubmitStatus";
import { currentEnv } from "../lib/browser-env";
import { loadPrefs, releaseFocus } from "../lib/prefs";
import { useRun } from "../lib/useRun";

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;

function Checklist({ items }: { items: { id: string; label: string; pass: boolean }[] }) {
  return (
    <ul className="space-y-1 text-sm" data-testid="checklist">
      {items.map((c) => (
        <li key={c.id} data-pass={c.pass} className={c.pass ? "text-accent" : "text-sub"}>
          {c.pass ? "✓" : "○"} {c.label}
        </li>
      ))}
    </ul>
  );
}

function ScenarioGame({ scenario, platform, onExit }: { scenario: Scenario; platform: Platform; onExit: () => void }) {
  const prefs = useMemo(loadPrefs, []);
  const [layout, setLayout] = useState<LayoutId>(() => prefs.layout ?? "us");
  const [search] = useSearchParams();
  const makeRun = useCallback(
    () => createRun({
      seed: Number(search.get("seed") ?? Math.floor(Math.random() * 2 ** 32)),
      mode: { kind: "scenario", id: scenario.id }, platform, layout, today: utcDate(Date.now()),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenario.id, platform],
  );
  const { run, now, flash, restart } = useRun({ makeRun, layout, setLayout });
  const cur = run.current!;
  const items = checklist(scenario, cur.state, cur.params as { platform: Platform });

  if (run.finishedAt !== null) return <ScenarioResult run={run} scenario={scenario} items={items} onRetry={restart} onExit={onExit} />;
  return (
    <div className="space-y-4">
      <GameBoard
        run={run} now={now} flash={flash} label={scenario.title}
        promptExtra={<div className="mt-2"><Checklist items={items} /></div>}
      />
    </div>
  );
}

function ScenarioResult({ run, scenario, items, onRetry, onExit }: { run: RunState; scenario: Scenario; items: ReturnType<typeof checklist>; onRetry: () => void; onExit: () => void }) {
  const s = scoreRun(run);
  const done = s.completed === 1;
  return (
    <div className="space-y-6 py-4" data-testid="results">
      <div>
        <p className="text-xs text-sub">{scenario.title}</p>
        <p className={`text-5xl font-bold tabular-nums ${done ? "text-accent" : "text-warn"}`} data-testid="scenario-time">
          {done ? fmt(s.elapsedMs) : "time's up"}
        </p>
        <p className="mt-1 text-sm text-sub">
          {items.filter((c) => c.pass).length}/{items.length} conditions · efficiency {Math.round(s.efficiency * 100)}%
        </p>
      </div>
      <Checklist items={items} />
      {done && <SubmitStatus run={run} daily={false} />}
      <p className="flex gap-3 text-sm">
        <button className="rounded border border-accent px-3 py-1 text-accent hover:bg-accent hover:text-bg" onClick={() => { releaseFocus(); onRetry(); }}>retry (Enter)</button>
        <button className="rounded border border-line px-3 py-1 hover:border-text" onClick={onExit}>all scenarios</button>
        <Link to="/leaderboard?tab=scenarios" className="self-center text-sub underline">leaderboard</Link>
      </p>
    </div>
  );
}

export default function Speedrun() {
  const env = useMemo(currentEnv, []);
  const [search, setSearch] = useSearchParams();
  const prefs = useMemo(loadPrefs, []);
  const [platform, setPlatform] = useState<Platform>(() => (search.get("platform") as Platform | null) ?? prefs.platform ?? defaultPlatform(env));
  const active = SCENARIOS.find((s) => s.id === search.get("scenario"));

  if (env.mobile) return <p className="py-20 text-center text-sub">Speedruns need a physical keyboard.</p>;
  if (active) {
    return (
      <section className="pb-8">
        <ScenarioGame key={`${active.id}-${platform}`} scenario={active} platform={platform} onExit={() => setSearch({})} />
      </section>
    );
  }
  return (
    <section className="space-y-6 pb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Analyst mode</h1>
          <p className="text-sm text-sub">Real modelling chores against the clock. Keyboard only. Fastest clean run wins.</p>
        </div>
        <select aria-label="platform" className="rounded bg-panel px-2 py-1 text-sm" value={platform} onChange={(e) => { setPlatform(e.target.value as Platform); releaseFocus(); }}>
          <option value="win">Windows</option>
          <option value="mac">macOS</option>
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {SCENARIOS.map((s) => {
          const inst = s.setup(mulberry32(1), { today: "2026-01-01", platform });
          const items = checklist(s, inst.state, inst.params);
          return (
            <div key={s.id} className="flex flex-col rounded border border-line bg-panel p-4">
              <h2 className="font-bold">{s.title}</h2>
              <p className="mt-1 text-xs text-sub">{Math.round(s.timeLimitS / 60)} min limit · {items.length} conditions</p>
              <ul className="mt-3 flex-1 space-y-1 text-xs text-sub">
                {items.map((c) => <li key={c.id}>○ {c.label}</li>)}
              </ul>
              <button
                className="mt-4 rounded border border-accent px-3 py-1 text-sm text-accent hover:bg-accent hover:text-bg"
                onClick={() => { releaseFocus(); setSearch({ scenario: s.id, platform }); }}
              >
                start
              </button>
            </div>
          );
        })}
      </div>
      {platform === "mac" && (
        <p className="text-xs text-sub">On Mac, conditions that need a Windows-only shortcut (font colour, autofit) are left out: Excel for Mac has no keyboard shortcut for them.</p>
      )}
    </section>
  );
}
