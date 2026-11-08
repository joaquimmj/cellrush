import { useCallback } from "react";
import { useSettings, type Lang } from "../lib/settings";
import { en, type MessageKey } from "./en";
import { fr } from "./fr";

const DICTS: Record<Lang, Record<MessageKey, string>> = { en, fr };

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const text = DICTS[lang][key] ?? en[key];
  return vars ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : text;
}

/** `const t = useT(); t("res.score")` — re-renders when the language changes. */
export function useT() {
  const { settings } = useSettings();
  return useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(settings.lang, key, vars), [settings.lang]);
}

export type { MessageKey };
