/** Single source of truth for the product name (chosen 2026-11-08). */
export const APP_NAME = "cellrush";
export const APP_TAGLINE = "How fast are you without a mouse?";
export const DISCLAIMER = "Not affiliated with Microsoft. Excel is a trademark of Microsoft Corporation.";
/** Where the app lives, e.g. "joaquimmj.github.io/cellrush" (shown at the end of share texts). */
export const appHome = () =>
  typeof window === "undefined" ? "github.com/joaquimmj/cellrush" : `${window.location.host}${import.meta.env.BASE_URL.replace(/\/$/, "")}`;
/** Absolute URL of a path inside the app ("/r/x" → "https://joaquimmj.github.io/cellrush/r/x"). */
export const appUrl = (path: string) => `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}${path}`;
