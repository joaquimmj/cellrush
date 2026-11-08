import { expect, test } from "@playwright/test";
import { freezeClock, playUntilResults, toPress } from "./bot";

test.describe("speedrun scenarios", () => {
  test("the list shows the three scenarios with their conditions", async ({ page }) => {
    await page.goto("/speedrun?platform=win");
    await expect(page.getByRole("heading", { name: "Format a P&L to banking standards" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Build a revenue projection" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Clean a data dump" })).toBeVisible();
  });

  for (const platform of ["win", "mac"] as const) {
    for (const id of ["pnl-banking", "revenue-projection", "clean-data"]) {
      test(`${id} on ${platform}: solved → every box ticked, time shown`, async ({ page }) => {
        await freezeClock(page, "2026-11-20T10:00:00Z");
        await page.goto(`/speedrun?scenario=${id}&platform=${platform}&seed=5`);
        const items = page.getByTestId("checklist").locator("li");
        await expect(items.first()).toHaveAttribute("data-pass", "false");
        await playUntilResults(page, 100);
        await expect(page.getByTestId("scenario-time")).toHaveText(/^\d:\d\d\.\d$/);
        const all = await page.getByTestId("checklist").locator("li").count();
        await expect(page.getByTestId("checklist").locator('li[data-pass="true"]')).toHaveCount(all);
      });
    }
  }

  test("running out of time ends the scenario with the checklist as it stands", async ({ page }) => {
    await freezeClock(page, "2026-11-20T10:00:00Z");
    await page.goto("/speedrun?scenario=revenue-projection&platform=win&seed=5");
    await expect(page.getByTestId("prompt")).toBeVisible(); // pages are lazy-loaded: wait before typing
    await page.keyboard.press("Shift+ArrowDown"); // starts the clock
    await page.clock.fastForward(181_000);
    await expect(page.getByTestId("scenario-time")).toHaveText("time's up");
    await expect(page.getByTestId("checklist").locator('li[data-pass="true"]')).toHaveCount(0);
  });
});

test.describe("learn mode", () => {
  test("hint after 4 s of hesitation; hinted drills go to the review list", async ({ page }) => {
    await freezeClock(page, "2026-11-20T10:00:00Z");
    await page.goto("/learn?platform=win&seed=3");
    await expect(page.getByTestId("prompt")).toBeVisible();
    await expect(page.getByTestId("hint")).toHaveCount(0);

    await page.clock.fastForward(3000);
    await expect(page.getByTestId("hint")).toHaveCount(0);
    await page.clock.fastForward(1500);
    await expect(page.getByTestId("hint")).toBeVisible();
    await expect(page.getByTestId("hint")).toContainText("hint:");

    // Solve it with the hint's keys.
    const first = await page.evaluate(() => window.__cellrush!.run().current!.task.id);
    for (const k of (await page.evaluate(() => window.__cellrush!.optimalKeys()))!) await page.keyboard.press(toPress(k));
    await expect(page.getByText("will come back soon")).toBeVisible();
    await expect(page.getByTestId("review")).toContainText(first.replace(/-/g, " "));

    // Next drill solved straight away → clean, and the hint is gone.
    for (const k of (await page.evaluate(() => window.__cellrush!.optimalKeys()))!) await page.keyboard.press(toPress(k));
    await expect(page.getByText(/✓ .*: clean\./)).toBeVisible();
    await expect(page.getByTestId("hint")).toHaveCount(0);
  });

  test("progress survives a reload", async ({ page }) => {
    await freezeClock(page, "2026-11-20T10:00:00Z");
    await page.goto("/learn?platform=win&seed=8");
    await page.clock.fastForward(4500);
    for (const k of (await page.evaluate(() => window.__cellrush!.optimalKeys()))!) await page.keyboard.press(toPress(k));
    await expect(page.getByTestId("review").locator("li")).toHaveCount(1);
    await page.reload();
    await expect(page.getByTestId("review").locator("li")).toHaveCount(1);
  });
});
