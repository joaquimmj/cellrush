import { expect, type Page } from "@playwright/test";

interface RawKey {
  code: string;
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

/** Turn an engine keydown into a Playwright key press (Playwright accepts KeyboardEvent.code names). */
export function toPress(k: RawKey): string {
  if (k.code === "AltLeft") return "Alt";
  const mods = [k.ctrl && "Control", k.alt && "Alt", k.shift && "Shift", k.meta && "Meta"].filter(Boolean);
  return [...mods, k.code].join("+");
}

/** Freeze the page clock at `iso` (before loading) so runs are deterministic. */
export async function freezeClock(page: Page, iso: string) {
  const t = new Date(iso).getTime();
  await page.clock.install({ time: new Date(t - 30_000) });
  await page.clock.pauseAt(new Date(t));
}

/**
 * Play like a perfect player until the results screen: real key presses through the browser,
 * `stepMs` of virtual time after each drill. Asserts every drill is solved by its path.
 */
export async function playUntilResults(page: Page, stepMs = 1500): Promise<number> {
  let drills = 0;
  for (let i = 0; i < 200; i++) {
    if (await page.getByTestId("results").isVisible()) break;
    const keys = await page.evaluate(() => window.__cellrush?.optimalKeys() ?? null);
    if (!keys) break;
    const before = await page.getByTestId("prompt").textContent();
    for (const k of keys) await page.keyboard.press(toPress(k));
    if (!(await page.getByTestId("results").isVisible())) {
      const after = await page.evaluate(() => window.__cellrush!.run().results.length);
      expect(after, `drill ${i + 1} (“${before}”) not completed`).toBe(i + 1);
    }
    drills++;
    await page.clock.fastForward(stepMs);
  }
  await expect(page.getByTestId("results")).toBeVisible();
  return drills;
}
