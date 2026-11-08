import { expect, test } from "@playwright/test";
import { toPress } from "./bot";

test("keystroke → updated grid stays well under one 16 ms frame (p95)", async ({ page }) => {
  await page.goto("/?platform=win&mode=120s&seed=11");
  await expect(page.getByTestId("prompt")).toBeVisible();
  for (let i = 0; i < 25; i++) {
    const keys = await page.evaluate(() => window.__cellrush!.optimalKeys());
    if (!keys) break;
    for (const k of keys) await page.keyboard.press(toPress(k));
  }
  const samples = await page.evaluate(() => window.__cellrushPerf ?? []);
  expect(samples.length).toBeGreaterThan(40);
  const sorted = [...samples].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  console.log(`keystroke latency: n=${samples.length} median=${sorted[Math.floor(sorted.length / 2)]!.toFixed(2)}ms p95=${p95.toFixed(2)}ms max=${sorted[sorted.length - 1]!.toFixed(2)}ms`);
  expect(p95).toBeLessThan(16);
});

test.describe("settings, themes and French", () => {
  test("switching to French translates the UI and the drill prompts", async ({ page }) => {
    await page.goto("/settings");
    await page.getByLabel("language").selectOption("fr");
    await expect(page.getByRole("heading", { name: "Réglages" })).toBeVisible();
    await page.getByRole("link", { name: "jouer" }).click();
    await expect(page.getByText("démarre à ta première touche", { exact: true })).toBeVisible();
    await expect(page.getByTestId("intro")).toContainText("sans souris");
    await expect(page.getByTestId("prompt")).not.toHaveText(/^(Jump|Select|Go|Move|Type|Make|Format|Copy|Insert|Delete)\b/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  });

  test("a theme applies its colours and survives a reload", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("radio", { name: "Paper" }).click();
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await bg()).toBe("rgb(244, 236, 216)");
    await page.reload();
    expect(await bg()).toBe("rgb(244, 236, 216)");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  });

  test("animations off adds the no-anim class", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("switch", { name: "animations" }).click();
    await expect(page.locator("html")).toHaveClass(/no-anim/);
  });
});

test.describe("phones", () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });

  test("game pages show the keyboard notice; leaderboards stay readable", async ({ page }) => {
    for (const path of ["/", "/daily", "/speedrun", "/learn"]) {
      await page.goto(path);
      await expect(page.getByTestId("mobile-notice"), path).toBeVisible();
    }
    await page.getByRole("link", { name: /leaderboards/ }).click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
