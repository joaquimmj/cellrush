import { expect, test, type Page } from "@playwright/test";

interface RawKey {
  code: string;
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

/** Turn an engine keydown into a Playwright key press (Playwright accepts KeyboardEvent.code names). */
function toPress(k: RawKey): string {
  if (k.code === "AltLeft") return "Alt";
  const mods = [k.ctrl && "Control", k.alt && "Alt", k.shift && "Shift", k.meta && "Meta"].filter(Boolean);
  return [...mods, k.code].join("+");
}

async function optimalKeys(page: Page): Promise<RawKey[] | null> {
  return page.evaluate(() => window.__cellrush?.optimalKeys() ?? null);
}

/**
 * Plays a full 60-second run like a perfect player: real key presses through the browser,
 * the page clock paused and moved 1.5 s forward after each drill, so the count is deterministic.
 */
async function playFullRun(page: Page, platform: "win" | "mac") {
  await page.clock.install({ time: new Date("2026-11-08T10:00:00Z") });
  // Pause before loading, so page-load time can't eat into the run.
  await page.clock.pauseAt(new Date("2026-11-08T10:00:30Z"));
  await page.goto(`/?platform=${platform}&mode=60s&seed=20261108`);
  await expect(page.getByTestId("prompt")).toBeVisible();
  await expect(page.getByTestId("clock")).toHaveText("60");

  let drills = 0;
  for (let i = 0; i < 200; i++) {
    if (await page.getByTestId("results").isVisible()) break;
    const keys = await optimalKeys(page);
    if (!keys) break;
    const before = await page.getByTestId("prompt").textContent();
    for (const k of keys) await page.keyboard.press(toPress(k));
    // Each drill must be solved by its path: the prompt moves on (or the run ends).
    if (!(await page.getByTestId("results").isVisible())) {
      const after = await page.evaluate(() => window.__cellrush!.run().results.length);
      expect(after, `drill ${i + 1} (“${before}”) not completed`).toBe(i + 1);
    }
    drills++;
    await page.clock.fastForward(1500);
  }

  await expect(page.getByTestId("results")).toBeVisible();
  const completed = Number((await page.getByTestId("completed").textContent())!.split(" ")[0]);
  // 60 s at 1.5 s per drill ≈ 40 drills.
  expect(completed).toBeGreaterThanOrEqual(35);
  expect(completed).toBeLessThanOrEqual(drills);
  await expect(page.getByTestId("efficiency")).toHaveText("100%");
  expect(Number(await page.getByTestId("score").textContent())).toBeGreaterThan(0);
}

test.describe("full 60 s run", () => {
  test("Windows keymap", async ({ page }) => {
    await playFullRun(page, "win");
  });
  test("Mac keymap", async ({ page }) => {
    await playFullRun(page, "mac");
  });
});

test("the clock waits for the first key", async ({ page }) => {
  await page.clock.install();
  await page.goto("/?platform=win&mode=30s&seed=1");
  await page.clock.fastForward(10_000);
  await expect(page.getByTestId("clock")).toHaveText("30");
});

test("Enter on the results screen starts a new run", async ({ page }) => {
  await page.clock.install();
  await page.goto("/?platform=win&mode=30s&seed=2");
  await page.keyboard.press("Shift+Escape"); // skip one drill: starts the clock
  await page.clock.fastForward(31_000);
  await expect(page.getByTestId("results")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("prompt")).toBeVisible();
  await expect(page.getByTestId("clock")).toHaveText("30");
});

test("mouse clicks on the grid are refused", async ({ page }) => {
  await page.goto("/?platform=win&mode=60s&seed=3");
  await page.locator("tbody td").nth(30).click();
  await expect(page.getByText("keyboard only ⌨")).toBeVisible();
});
