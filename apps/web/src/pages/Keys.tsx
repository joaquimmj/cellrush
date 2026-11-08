import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CAPTURE_COMBOS,
  LAYOUT_NAMES,
  defaultPlatform,
  formatChord,
  guessLayout,
  isModifierOnly,
  matchesChord,
  rawId,
  type CaptureMode,
  type CaptureResult,
  type LayoutId,
  type Platform,
  type RawKey,
} from "@cellrush/engine";
import { currentEnv, enterFocusMode, exitFocusMode, toRaw } from "../lib/browser-env";

type Status = "captured" | "blocked";
type Statuses = Record<string, Status>;

const STORE = "cellrush.keys.v1";
const load = (): Record<CaptureMode, Statuses> => {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "");
    if (v && typeof v === "object") return { normal: v.normal ?? {}, lock: v.lock ?? {} };
  } catch {
    /* empty or blocked storage */
  }
  return { normal: {}, lock: {} };
};

const RISK_LABEL: Record<string, string> = {
  "closes-tab": "may close the tab",
  "new-window": "may open a tab/window",
  "quits-app": "quits the browser — skip",
  "os-level": "OS shortcut",
};

export default function Keys() {
  const env = useMemo(currentEnv, []);
  const [platform, setPlatform] = useState<Platform>(() => defaultPlatform(env));
  const [layout, setLayout] = useState<LayoutId>("us");
  const [layoutAuto, setLayoutAuto] = useState(true);
  const [lockActive, setLockActive] = useState(false);
  const [all, setAll] = useState(load);
  const [log, setLog] = useState<{ id: string; key: string; hit?: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const samples = useRef<{ code: string; key: string }[]>([]);

  const mode: CaptureMode = lockActive ? "lock" : "normal";
  const statuses = all[mode];
  const combos = useMemo(() => CAPTURE_COMBOS.filter((c) => c.platform === platform), [platform]);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  }, [all]);

  const mark = useCallback(
    (id: string, s: Status | undefined) =>
      setAll((prev) => {
        const next = { ...prev[mode] };
        if (s) next[id] = s;
        else delete next[id];
        return { ...prev, [mode]: next };
      }),
    [mode],
  );

  // Capture every keydown. preventDefault stops the browser action whenever the page receives the event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const raw: RawKey = toRaw(e);
      const hit = combos.find((c) => matchesChord(c.chord, raw, layout));
      // Let a lone Escape through so the user can leave fullscreen.
      if (!(e.key === "Escape" && !raw.ctrl && !raw.alt && !raw.meta && !raw.shift)) e.preventDefault();
      if (hit) mark(hit.id, "captured");
      if (!isModifierOnly(raw) && !raw.ctrl && !raw.meta && !raw.alt && e.key.length === 1) {
        samples.current = [...samples.current.slice(-20), { code: raw.code, key: e.key }];
        if (layoutAuto) {
          const g = guessLayout(samples.current);
          if (g) setLayout(g);
        }
      }
      if (hit || !isModifierOnly(raw) || raw.code === "AltLeft") {
        setLog((l) => [{ id: rawId(raw), key: e.key, hit: hit?.id }, ...l].slice(0, 10));
      }
    };
    // Alt alone fires on keyup in some browsers; record it there too.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "AltLeft" && platform === "win") {
        e.preventDefault();
        mark("win.alt", "captured");
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
    };
  }, [combos, layout, layoutAuto, mark, platform]);

  // If Ctrl/Cmd+W slips past us, ask before the tab closes so results are not lost.
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setLockActive(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const tested = combos.filter((c) => statuses[c.id]).length;
  const result: CaptureResult = {
    browser: env.browser,
    browserVersion: env.browserVersion,
    os: env.os,
    mode,
    testedAt: new Date().toISOString().slice(0, 10),
    captured: combos.filter((c) => statuses[c.id] === "captured").map((c) => c.id),
    blocked: combos.filter((c) => statuses[c.id] === "blocked").map((c) => c.id),
  };
  const json = JSON.stringify(result, null, 2);

  const markRestBlocked = () =>
    setAll((prev) => {
      const next = { ...prev[mode] };
      for (const c of combos) if (!next[c.id] && c.risk !== "quits-app") next[c.id] = "blocked";
      return { ...prev, [mode]: next };
    });

  if (env.mobile) {
    return <p className="py-20 text-center text-sub">This page needs a physical keyboard. Open it on a computer.</p>;
  }

  return (
    <section className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold">Key capture test</h1>
        <p className="mt-2 max-w-3xl text-sm text-sub">
          Browsers keep some shortcuts for themselves. Press each combo below: it turns green if this page received it. If
          nothing happens (or the browser acts instead), mark it blocked. Then export the JSON.
        </p>
      </div>

      <div className="grid gap-3 rounded border border-line bg-panel p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label="browser" value={`${env.browser} ${env.browserVersion}`} />
        <Info label="os" value={env.os} />
        <Info label="mode" value={lockActive ? "fullscreen + keyboard lock" : "normal tab"} accent={lockActive} />
        <Info label="keyboard lock api" value={env.keyboardLockSupported ? "supported" : "not supported"} />
        <label className="flex flex-col gap-1">
          <span className="text-xs text-sub">shortcut set</span>
          <select className="rounded bg-bg px-2 py-1" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
            <option value="win">Windows</option>
            <option value="mac">macOS</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-sub">layout {layoutAuto && "(auto — type a few letters)"}</span>
          <select
            className="rounded bg-bg px-2 py-1"
            value={layout}
            onChange={(e) => {
              setLayout(e.target.value as LayoutId);
              setLayoutAuto(false);
            }}
          >
            {(Object.keys(LAYOUT_NAMES) as LayoutId[]).map((l) => (
              <option key={l} value={l}>{LAYOUT_NAMES[l]}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2">
          {lockActive ? (
            <button className="rounded border border-line px-3 py-1 hover:border-text" onClick={() => void exitFocusMode()}>
              Exit fullscreen
            </button>
          ) : (
            <button
              className="rounded border border-accent px-3 py-1 text-accent hover:bg-accent hover:text-bg disabled:opacity-40"
              disabled={!env.keyboardLockSupported}
              title={env.keyboardLockSupported ? "" : "Keyboard Lock is Chromium-only (Chrome, Edge)"}
              onClick={async () => setLockActive(await enterFocusMode())}
            >
              Fullscreen + Keyboard Lock
            </button>
          )}
          {lockActive && <span className="text-xs text-sub">Hold Esc to leave.</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>
          {tested}/{combos.length} tested in <b>{mode}</b> mode
        </span>
        <div className="flex gap-2">
          <button className="rounded border border-line px-3 py-1 hover:border-text" onClick={markRestBlocked}>
            Mark untested as blocked
          </button>
          <button
            className="rounded border border-line px-3 py-1 hover:border-bad hover:text-bad"
            onClick={() => setAll((p) => ({ ...p, [mode]: {} }))}
          >
            Reset {mode}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <ul className="divide-y divide-line rounded border border-line">
          {combos.map((c) => {
            const s = statuses[c.id];
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <span
                  aria-label={s ?? "untested"}
                  className={`h-3 w-3 shrink-0 rounded-sm ${s === "captured" ? "bg-accent" : s === "blocked" ? "bg-bad" : "bg-line"}`}
                />
                <kbd className="min-w-28 font-bold">{formatChord(c.chord, platform, layout)}</kbd>
                <span className="flex-1 text-xs text-sub">
                  {c.risk && <span className="mr-2 text-warn">⚠ {RISK_LABEL[c.risk]}</span>}
                  {c.note}
                </span>
                {s !== "captured" && (
                  <button
                    className={`rounded px-2 py-0.5 text-xs ${s === "blocked" ? "text-bad" : "text-sub hover:text-bad"}`}
                    onClick={() => mark(c.id, s === "blocked" ? undefined : "blocked")}
                  >
                    {s === "blocked" ? "blocked ✕" : "mark blocked"}
                  </button>
                )}
                {s === "captured" && (
                  <button className="text-xs text-sub hover:text-text" onClick={() => mark(c.id, undefined)}>
                    undo
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <aside className="space-y-4">
          <div className="rounded border border-line p-3">
            <h2 className="mb-2 text-xs text-sub">last keys received</h2>
            {log.length === 0 && <p className="text-xs text-sub">Press anything…</p>}
            <ul className="space-y-1 text-xs">
              {log.map((l, i) => (
                <li key={i} className={l.hit ? "text-accent" : ""}>
                  {l.id} <span className="text-sub">“{l.key}”</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded border border-line p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs text-sub">export ({mode})</h2>
              <button
                className="text-xs text-accent hover:underline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(json);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    /* clipboard denied: user can select the text */
                  }
                }}
              >
                {copied ? "copied" : "copy JSON"}
              </button>
            </div>
            <textarea readOnly value={json} className="h-48 w-full resize-none rounded bg-bg p-2 text-[11px] text-sub" />
          </div>
        </aside>
      </div>
    </section>
  );
}

function Info({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-sub">{label}</span>
      <span className={accent ? "text-accent" : ""}>{value}</span>
    </div>
  );
}
