import { expect, test } from "@playwright/test";
import { freezeClock, playUntilResults } from "./bot";

// Brief §13: "cellrush daily #42 ⏱ 48.3s / squares / score 412 · efficiency 87% / <where the app lives>"
const SHARE = /^cellrush daily #13 ⏱ \d+\.\ds\n(🟩|🟨|⬛){10}\nscore \d+ · efficiency \d{1,3}%\n[\w.:-]+(\/cellrush)?$/u; // the app's own address (localhost in tests)

test.describe("daily challenge", () => {
  test.beforeEach(async ({ page }) => {
    await freezeClock(page, "2026-11-20T10:00:00Z"); // daily #13
  });

  test("10 drills, §13 share text, only the first attempt is ranked", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/daily?platform=win");
    await expect(page.getByRole("heading", { name: /Daily #13/ })).toBeVisible();
    await expect(page.getByTestId("clock")).toHaveText("0/10");

    const drills = await playUntilResults(page, 1000);
    expect(drills).toBe(10);
    const share = (await page.getByTestId("share-text").textContent())!;
    expect(share).toMatch(SHARE);
    expect(share.split("\n")[1]).toBe("🟩".repeat(10));
    // The clock starts on the first key; 9 gaps of 1 s separate the 10 drills.
    expect(share).toContain("⏱ 9.0s");

    // Copy result → clipboard holds exactly the share text.
    await page.getByRole("button", { name: "copy result" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(share);

    // Coming back the same day shows the ranked result instead of a new ranked run.
    await page.reload();
    await expect(page.getByText("You already played today's daily")).toBeVisible();
    await expect(page.getByTestId("share-text")).toHaveText(share);

    // Practice is allowed but clearly not ranked.
    await page.getByRole("button", { name: /practise it again/ }).click();
    await expect(page.getByText("practice run, not ranked")).toBeVisible();
    await expect(page.getByTestId("prompt")).toBeVisible();
  });

  test("same drills for two players on the same day", async ({ browser }) => {
    const prompts: string[] = [];
    for (let i = 0; i < 2; i++) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await freezeClock(page, "2026-11-20T18:30:00Z");
      await page.goto("/daily?platform=mac");
      prompts.push((await page.getByTestId("prompt").textContent())!);
      await ctx.close();
    }
    expect(prompts[0]).toBe(prompts[1]);
  });
});

test("a shared result link opens the result page", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await freezeClock(page, "2026-11-20T10:00:00Z");
  await page.goto("/daily?platform=win");
  await playUntilResults(page, 1000);
  const score = (await page.getByTestId("score").textContent())!;
  await page.getByRole("button", { name: "copy link" }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/r\/[A-Za-z0-9_-]+$/);

  await page.goto(link);
  await expect(page.getByTestId("result-page")).toBeVisible();
  await expect(page.getByTestId("result-page")).toContainText(score);
  await expect(page.getByTestId("result-page")).toContainText("Daily #13 · 2026-11-20 · Windows shortcuts");
  await expect(page.getByRole("link", { name: /play today's daily/ })).toBeVisible();
});

test("a broken result link says so", async ({ page }) => {
  await page.goto("/r/not-a-real-id");
  await expect(page.getByText("This result link is broken or incomplete.")).toBeVisible();
});
