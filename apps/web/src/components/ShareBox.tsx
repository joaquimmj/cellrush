import { useState } from "react";
import { encodeResult, shareText, type ShareSummary } from "@cellrush/drills";
import { APP_DOMAIN, APP_NAME } from "../config";
import { useT } from "../i18n";
import { releaseFocus } from "../lib/prefs";

/** Absolute link to a result page. */
export const resultUrl = (s: ShareSummary) => `${window.location.origin}/r/${encodeResult(s)}`;

/** Share text (§13 format) with copy buttons for the text and for a link to the result page. */
export default function ShareBox({ summary }: { summary: ShareSummary }) {
  const t = useT();
  const [copied, setCopied] = useState<"text" | "link" | null>(null);
  const text = shareText(summary, APP_NAME, APP_DOMAIN);

  const copy = async (what: "text" | "link") => {
    releaseFocus();
    try {
      await navigator.clipboard.writeText(what === "text" ? text : resultUrl(summary));
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked: the text stays selectable below */
    }
  };

  return (
    <div className="rounded border border-line bg-panel p-4">
      <pre data-testid="share-text" className="mb-3 font-mono text-sm leading-6 whitespace-pre-wrap select-all">{text}</pre>
      <div className="flex flex-wrap gap-2 text-sm">
        <button className="rounded border border-accent px-3 py-1 text-accent hover:bg-accent hover:text-bg" onClick={() => copy("text")}>
          {copied === "text" ? t("share.copied") : t("share.copyResult")}
        </button>
        <button className="rounded border border-line px-3 py-1 hover:border-text" onClick={() => copy("link")}>
          {copied === "link" ? t("share.linkCopied") : t("share.copyLink")}
        </button>
      </div>
    </div>
  );
}
