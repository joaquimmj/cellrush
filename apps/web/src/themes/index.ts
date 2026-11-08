// Themes are plain JSON so anyone can add one in a PR (docs/ADDING_A_THEME.md).
import amber from "./amber-terminal.json";
import dark from "./dark.json";
import highContrast from "./high-contrast.json";
import light from "./light.json";
import navyGold from "./navy-gold.json";
import navy from "./navy.json";
import paper from "./paper.json";
import terminal from "./terminal-green.json";

export const COLOR_KEYS = ["bg", "panel", "line", "sub", "text", "accent", "warn", "bad"] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

export interface Theme {
  id: string;
  label: string;
  scheme: "dark" | "light";
  colors: Record<ColorKey, string>;
}

export const THEMES: readonly Theme[] = [dark, light, terminal, amber, navy, paper, highContrast, navyGold] as Theme[];
export const themeById = (id: string): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0]!;

/** Apply a theme by overriding the CSS variables Tailwind's colours read from. */
export function applyTheme(t: Theme, root: HTMLElement = document.documentElement) {
  for (const k of COLOR_KEYS) root.style.setProperty(`--color-${k}`, t.colors[k]);
  root.style.colorScheme = t.scheme;
  root.dataset.theme = t.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.colors.bg);
}

// ── WCAG contrast (used by the theme test and available to contributors) ──
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}
