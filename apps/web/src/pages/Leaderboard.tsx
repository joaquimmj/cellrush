import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Platform } from "@cellrush/engine";
import { dailyNumber, squaresOf, utcDate } from "@cellrush/drills";
import { supabase } from "../lib/supabase";
import { COUNTRIES } from "./Profile";

type Tab = "daily" | "30s" | "60s" | "120s" | "25t" | "50t" | "schools" | "countries" | "sc-pnl-banking" | "sc-revenue-projection" | "sc-clean-data";
const TABS: { id: Tab; label: string }[] = [
  { id: "daily", label: "today's daily" },
  { id: "30s", label: "30s" },
  { id: "60s", label: "60s" },
  { id: "120s", label: "120s" },
  { id: "25t", label: "25 tasks" },
  { id: "50t", label: "50 tasks" },
  { id: "schools", label: "schools" },
  { id: "countries", label: "countries" },
  { id: "sc-pnl-banking", label: "P&L speedrun" },
  { id: "sc-revenue-projection", label: "projection speedrun" },
  { id: "sc-clean-data", label: "cleanup speedrun" },
];
const isScenario = (t: Tab) => t.startsWith("sc-");
const fmtTime = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
const countryName = (c: string | null) => (c ? COUNTRIES.find(([k]) => k === c)?.[1] ?? c : "");

type Row = Record<string, string | number | null>;

export default function Leaderboard() {
  const [search] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (search.get("tab") === "scenarios" ? "sc-pnl-banking" : "daily"));
  const [platform, setPlatform] = useState<Platform>("win");
  const [groupMode, setGroupMode] = useState<"30s" | "60s" | "120s">("60s");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = utcDate(Date.now());

  useEffect(() => {
    if (!supabase) return;
    setRows(null);
    setError(null);
    const q =
      isScenario(tab) ? supabase.rpc("leaderboard_scenario", { p_id: tab.slice(3), p_platform: platform })
      : tab === "daily" ? supabase.rpc("leaderboard_daily", { p_daily: dailyNumber(today), p_platform: platform })
      : tab === "schools" || tab === "countries"
        ? supabase.rpc("leaderboard_groups", { p_group: tab === "schools" ? "school" : "country", p_mode: groupMode, p_platform: platform })
        : supabase.rpc("leaderboard_mode", { p_mode: tab, p_platform: platform });
    q.then(({ data, error }) => {
      if (error) setError(error.message);
      else setRows((data as Row[]) ?? []);
    });
  }, [tab, platform, groupMode, today]);

  if (!supabase) return <p className="py-20 text-center text-sub">Leaderboards are not set up on this server.</p>;
  const groups = tab === "schools" || tab === "countries";
  const btn = (on: boolean) => `rounded px-2 py-1 ${on ? "text-accent" : "text-sub hover:text-text"}`;

  return (
    <section className="space-y-4 pb-10">
      <h1 className="text-2xl font-bold">Leaderboards</h1>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded bg-panel px-3 py-2 text-sm">
        <div className="flex flex-wrap">{TABS.map((t) => <button key={t.id} className={btn(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
        <div className="flex">
          <button className={btn(platform === "win")} onClick={() => setPlatform("win")}>Windows</button>
          <button className={btn(platform === "mac")} onClick={() => setPlatform("mac")}>macOS</button>
        </div>
        {groups && (
          <select aria-label="mode" className="rounded bg-bg px-2 py-1" value={groupMode} onChange={(e) => setGroupMode(e.target.value as typeof groupMode)}>
            <option value="30s">30s</option><option value="60s">60s</option><option value="120s">120s</option>
          </select>
        )}
      </div>
      <p className="text-xs text-sub">
        {isScenario(tab) ? "Fastest completed run per player. " : tab === "daily" ? `Daily #${dailyNumber(today)}, first attempts only. ` : groups ? "Average of each member's best run; 3 players minimum. " : "Best run per player. "}
        Every score was replayed and checked on the server.
      </p>
      {error && <p className="text-bad">{error}</p>}
      {rows === null && !error && <p className="text-sub">loading…</p>}
      {rows?.length === 0 && <p className="text-sub">No ranked runs yet. Be the first.</p>}
      {rows && rows.length > 0 && (
        <table className="w-full text-sm" data-testid="leaderboard">
          <thead className="text-left text-xs text-sub">
            <tr>
              <th className="py-1 pr-2">#</th>
              {groups ? <><th>{tab === "schools" ? "school" : "country"}</th><th>players</th><th className="text-right">avg</th><th className="text-right">best</th></>
                : <><th>player</th><th>school</th><th>country</th><th className="text-right">{isScenario(tab) ? "time" : "score"}</th><th className="text-right">efficiency</th>{tab === "daily" && <th className="pl-3">run</th>}</>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1 pr-2 text-sub">{r.rank}</td>
                {groups ? (
                  <>
                    <td>{tab === "countries" ? countryName(r.name as string) : r.name}</td>
                    <td>{r.players}</td>
                    <td className="text-right font-bold">{r.avg_score}</td>
                    <td className="text-right">{r.best_score}</td>
                  </>
                ) : (
                  <>
                    <td className="font-bold">{r.display_name}</td>
                    <td className="text-sub">{r.school ?? ""}</td>
                    <td className="text-sub">{countryName(r.country as string | null)}</td>
                    <td className="text-right font-bold text-accent">{isScenario(tab) ? fmtTime(Number(r.elapsed_ms)) : r.score}</td>
                    <td className="text-right">{Math.round(Number(r.efficiency) * 100)}%</td>
                    {tab === "daily" && <td className="pl-3 tracking-widest">{squaresOf({ squares: String(r.squares ?? "") } as never)}</td>}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
