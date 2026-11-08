import { useMemo, useState } from "react";
import { LAYOUT_NAMES, defaultPlatform, type LayoutId, type Platform } from "@cellrush/engine";
import { useT } from "../i18n";
import { currentEnv } from "../lib/browser-env";
import { loadPrefs, releaseFocus, savePrefs } from "../lib/prefs";
import { click, useSettings, type Lang } from "../lib/settings";
import { THEMES } from "../themes";

export default function SettingsPage() {
  const t = useT();
  const { settings, update } = useSettings();
  const env = useMemo(currentEnv, []);
  const [prefs, setPrefs] = useState(loadPrefs);
  const platform = prefs.platform ?? defaultPlatform(env);
  const layout = prefs.layout ?? "us";
  const setPref = (patch: Partial<typeof prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  };
  const field = "rounded border border-line bg-bg px-2 py-1";

  return (
    <section className="mx-auto max-w-2xl space-y-8 py-8" onChange={releaseFocus}>
      <h1 className="text-2xl font-bold">{t("set.title")}</h1>

      <fieldset>
        <legend className="mb-3 text-xs text-sub">{t("set.theme")}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t("set.theme")}>
          {THEMES.map((th) => (
            <button
              key={th.id}
              role="radio"
              aria-checked={settings.theme === th.id}
              onClick={() => update({ theme: th.id })}
              className={`rounded border-2 p-2 text-left text-xs ${settings.theme === th.id ? "border-accent" : "border-line"}`}
              style={{ background: th.colors.bg, color: th.colors.text }}
            >
              <span className="mb-1 flex gap-1" aria-hidden="true">
                {(["accent", "text", "sub", "warn"] as const).map((k) => (
                  <span key={k} className="h-3 w-3 rounded-sm" style={{ background: th.colors[k] }} />
                ))}
              </span>
              {th.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-sub">{t("set.language")}</span>
          <select className={field} value={settings.lang} onChange={(e) => update({ lang: e.target.value as Lang })}>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-sub">{t("set.platform")}</span>
          <select className={field} value={platform} onChange={(e) => setPref({ platform: e.target.value as Platform })}>
            <option value="win">{t("platform.win")}</option>
            <option value="mac">{t("platform.mac")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-sub">{t("set.layout")}</span>
          <select className={field} value={layout} onChange={(e) => setPref({ layout: e.target.value as LayoutId })}>
            {(Object.keys(LAYOUT_NAMES) as LayoutId[]).map((l) => <option key={l} value={l}>{LAYOUT_NAMES[l]}</option>)}
          </select>
        </label>
        <Toggle label={t("set.sound")} on={settings.sound} onLabel={t("set.on")} offLabel={t("set.off")} onChange={(v) => { update({ sound: v }); if (v) click(true); }} />
        <Toggle label={t("set.animations")} on={settings.animations} onLabel={t("set.on")} offLabel={t("set.off")} onChange={(v) => update({ animations: v })} />
      </div>
      <p className="text-xs text-sub">{t("set.saved")}</p>
    </section>
  );
}

function Toggle({ label, on, onChange, onLabel, offLabel }: { label: string; on: boolean; onChange: (v: boolean) => void; onLabel: string; offLabel: string }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-sub" id={`t-${label}`}>{label}</span>
      <button
        role="switch"
        aria-checked={on}
        aria-labelledby={`t-${label}`}
        onClick={() => onChange(!on)}
        className={`w-20 rounded border px-2 py-1 ${on ? "border-accent text-accent" : "border-line text-sub"}`}
      >
        {on ? onLabel : offLabel}
      </button>
    </div>
  );
}
