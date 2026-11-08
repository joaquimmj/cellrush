import { expect, test, type Page } from "@playwright/test";
import { freezeClock, playUntilResults } from "./bot";

/** A full 60-second run played perfectly; the paused clock moves 1.5 s per drill (≈40 drills). */
async function playFullRun(page: Page, platform: "win" | "mac") {
  await freezeClock(page, "2026-11-08T10:00:30Z");
  await page.goto(`/?platform=${platform}&mode=60s&seed=20261108`);
  await expect(page.getByTestId("prompt")).toBeVisible();
  await expect(page.getByTestId("clock")).toHaveText("60");

  const drills = await playUntilResults(page);

  const completed = Number((await page.getByTestId("completed").textContent())!.split(" ")[0]);
  expect(completed).toBeGreaterThanOrEqual(35);
  expect(completed).toBeLessThanOrEqual(drills);
  await expect(page.getByTestId("efficiency")).toHaveText("100%");
  expect(Number(await page.getByTestId("score").textContent())).toBeGreaterThan(0);
  await expect(page.getByTestId("share-text")).toContainText("cellrush 60s ⏱ 60.0s");
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
