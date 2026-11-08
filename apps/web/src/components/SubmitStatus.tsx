import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isRankable, scenarioById, toSubmission, type RunState } from "@cellrush/drills";
import { useT } from "../i18n";
import { supabase, useAccount } from "../lib/supabase";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ranked"; score: number }
  | { kind: "unranked"; score: number; flags: string[] }
  | { kind: "error"; message: string };

const KNOWN_FLAGS = new Set(["inhuman-speed", "robotic-timing", "impossible-tpm"]);

/**
 * Sends a finished run's keystrokes to the server, which replays them and decides the score.
 * Guests see an invitation to sign in instead.
 */
export default function SubmitStatus({ run, daily }: { run: RunState; daily: boolean }) {
  const t = useT();
  const { session, profile, ready } = useAccount();
  const [state, setState] = useState<State>({ kind: "idle" });
  const sent = useRef<RunState | null>(null);
  const mode = run.config.mode;
  // A scenario that needs a shortcut missing from Microsoft's official page is practice only.
  const practiceOnly = mode.kind === "scenario" && !isRankable(scenarioById(mode.id)!, run.config.platform);

  useEffect(() => {
    if (practiceOnly || !supabase || !session || !profile || run.finishedAt === null || sent.current === run) return;
    if (run.results.every((r) => r.status !== "done")) return;
    sent.current = run;
    setState({ kind: "sending" });
    supabase.functions
      .invoke("submit-run", { body: toSubmission(run, daily) })
      .then(async ({ data, error }) => {
        if (error) {
          // FunctionsHttpError carries the server's JSON in error.context.
          const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
          setState({ kind: "error", message: body?.error ?? error.message });
          return;
        }
        if (data.ranked) setState({ kind: "ranked", score: data.summary.score });
        else setState({ kind: "unranked", score: data.summary.score, flags: data.flags });
      });
  }, [run, daily, session, profile, practiceOnly]);

  if (practiceOnly) return <p className="text-sm text-sub" data-testid="submit-status">{t("submit.practiceOnly")}</p>;

  if (!supabase || !ready) return null;
  if (!session) {
    return (
      <p className="text-sm text-sub" data-testid="submit-status">
        <Link to="/login" className="text-accent hover:underline">{t("submit.signIn")}</Link> {t("submit.signInRest")}
      </p>
    );
  }
  if (!profile) {
    return (
      <p className="text-sm text-sub" data-testid="submit-status">
        <Link to="/profile" className="text-accent hover:underline">{t("submit.profile")}</Link> {t("submit.profileRest")}
      </p>
    );
  }
  const text =
    state.kind === "sending" ? t("submit.sending")
    : state.kind === "ranked" ? t("submit.ranked", { score: state.score })
    : state.kind === "unranked" ? t("submit.unranked", { flags: state.flags.map((f) => (KNOWN_FLAGS.has(f) ? t(`flag.${f}` as never) : f)).join(", ") })
    : state.kind === "error" ? t("submit.error", { message: state.message })
    : "";
  return (
    <p data-testid="submit-status" className={`text-sm ${state.kind === "ranked" ? "text-accent" : state.kind === "error" || state.kind === "unranked" ? "text-warn" : "text-sub"}`}>
      {text} {state.kind === "ranked" && <Link to="/leaderboard" className="underline">{t("submit.seeBoard")}</Link>}
    </p>
  );
}
