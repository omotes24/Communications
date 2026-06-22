import { expect, test } from "@playwright/test";

test("manual question flow with mock OpenAI", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());

  await page.goto("/profile");
  await page.getByLabel("現在の職種").fill("プロダクトマネージャー");
  await page
    .getByLabel("強み")
    .fill("顧客課題を構造化してチームを前進させる力");
  await page.getByLabel("実績").fill("オンボーディング改善で解約率を下げた");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("メインプロフィール")).toBeVisible();

  await page.goto("/company");
  await page.getByLabel("会社名").fill("サンプル株式会社");
  await page
    .getByLabel("ユーザーが感じている企業の魅力")
    .fill("現場に近い課題解決");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("応募先")).toBeVisible();

  await page.goto("/support");
  await page
    .getByLabel("参加者へAI支援利用を明示し、必要な同意を得ています。")
    .check();
  await page
    .getByLabel("手動質問入力")
    .fill("これまでの経験について教えてください。");
  await page.getByRole("button", { name: "回答案を作成" }).click();

  await expect(page.getByText("話すポイント3点")).toBeVisible();
  await expect(page.getByText("会社名: サンプル株式会社")).toBeVisible();
  await expect(page.getByText("使用した根拠情報")).toBeVisible();

  await page.getByRole("button", { name: "履歴に保存" }).click();
  await page.goto("/history");
  await expect(
    page.getByText("これまでの経験について教えてください。"),
  ).toBeVisible();

  await page.goto("/privacy");
  await page.getByRole("button", { name: "すべてのデータを削除" }).click();
  await expect(page.getByText("プロフィール: 0件")).toBeVisible();
});
