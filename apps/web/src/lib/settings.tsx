import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyTheme, themeById } from "../themes";

export type Lang = "en" | "fr";

export interface Settings {
  theme: string;
  lang: Lang;
  /** Soft click on every key the game uses. */
  sound: boolean;
  /** Cell flash, caret blink, confetti. Off → html.no-anim (reduced motion is always honoured). */
  animations: boolean;
}

const KEY = "cellrush.settings.v1";

function defaults(): Settings {
  const prefersLight = typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: light)").matches;
  const lang: Lang = typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
  return { theme: prefersLight ? "light" : "dark", lang, sound: false, animations: true };
}

function load(): Settings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && typeof v === "object") return { ...defaults(), ...v };
  } catch {
    /* blocked storage */
  }
  return defaults();
}

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}
const SettingsContext = createContext<Ctx>({ settings: defaults(), update: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    applyTheme(themeById(settings.theme));
    document.documentElement.lang = settings.lang;
    document.documentElement.classList.toggle("no-anim", !settings.animations);
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const value = useMemo<Ctx>(() => ({ settings, update: (patch) => setSettings((s) => ({ ...s, ...patch })) }), [settings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);

// ── key click: a 12 ms filtered noise burst, synthesized (no audio file) ──
let audio: AudioContext | null = null;
export function click(strong = false) {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    const len = Math.floor(ctx.sampleRate * 0.012);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = strong ? 1800 : 3200;
    const gain = ctx.createGain();
    gain.gain.value = strong ? 0.35 : 0.2;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  } catch {
    /* audio unavailable */
  }
}
