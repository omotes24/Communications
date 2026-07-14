import { expect, type Page, test } from "@playwright/test";

async function waitForStorageSave(page: Page) {
  await page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/storage") &&
      response.request().method() === "PUT" &&
      response.ok(),
  );
}

test("manual question flow with mock AI", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());

  await page.goto("/profile");
  await page.getByLabel("名前").fill("表 太郎");
  await page
    .getByLabel("在籍している大学・学年・学部・研究室など")
    .fill("慶應義塾大学 理工学部 4年 中澤・大越研究室");
  await page
    .getByLabel("自分スロット")
    .fill(
      "強み: 顧客課題を構造化してチームを前進させる力\n実績: オンボーディング改善で解約率を下げた",
    );
  const profileSave = waitForStorageSave(page);
  await page.getByRole("button", { name: "保存" }).click();
  await profileSave;
  await expect(page.getByText("新規作成しました。")).toBeVisible();

  await page.goto("/company");
  await expect(page.getByRole("button", { name: /SLOT A/ })).toBeVisible();
  await page.getByLabel("会社名").fill("サンプル株式会社");
  await page
    .getByLabel(/社風・採用情報.*特筆事項など\(詳細\)/)
    .fill(
      "社風: 顧客の現場課題を深く理解して改善する。\n採用情報: プロダクト職では課題設定力と実装推進力を重視。\nhttps://sample.example.com/recruit",
    );
  await page.getByLabel("志望コース").fill("プロダクト職 現場課題解決コース");
  await page.getByLabel("その他").fill("SatoFCの経験を中心に話したい");

  const companySave = waitForStorageSave(page);
  await page.getByRole("button", { name: "学習用スロット作成" }).click();
  await companySave;
  await expect(page.getByText("SLOT 1")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "サンプル株式会社" }),
  ).toBeVisible();

  await page.goto("/support");
  await expect(
    page.getByRole("heading", {
      name: "サンプル株式会社の面接を始めましょう！",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "STOP 自動送信停止" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "リアルタイム文字起こし" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "学習開始" }).click();
  await expect(page.getByText("学習済み", { exact: true })).toBeVisible();
  await expect(page.getByText("LLM学習済み")).toBeVisible();
  await page
    .getByLabel("手動質問入力")
    .fill("これまでの経験について教えてください。");
  await page.getByRole("button", { name: "回答案を作成" }).click();

  await expect(
    page.getByRole("heading", { name: "回答チャット" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "これまでの経験について教えてください。" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "履歴に保存" }).click();
  await page.goto("/history");
  await expect(
    page.getByText("これまでの経験について教えてください。"),
  ).toBeVisible();

  await page.goto("/account/privacy");
  await page.getByRole("button", { name: "アプリ内データを削除" }).click();
  await expect(page.getByText("プロフィール: 0件")).toBeVisible();
});

test("public legal and help pages render", async ({ page }) => {
  for (const path of [
    "/privacy",
    "/terms",
    "/account-deletion",
    "/help",
    "/pricing",
  ]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
  }
});

test("theme customizer persists and stays on home surfaces", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const root = page.locator("html");
  const customize = page.getByRole("button", {
    name: "Customize",
    exact: true,
  });

  await expect(root).toHaveAttribute("data-app-theme", "blue");
  await expect(customize).toHaveCount(1);
  await customize.click();
  await page.getByRole("radio", { name: "慶應カラー", exact: true }).click();
  await page.getByRole("radio", { name: "ダーク", exact: true }).click();
  await expect(root).toHaveAttribute("data-app-theme", "keio");
  await expect(root).toHaveAttribute("data-app-mode", "dark");

  await page.reload();
  await expect(root).toHaveAttribute("data-app-theme", "keio");
  await expect(root).toHaveAttribute("data-app-mode", "dark");

  await page.goto("/terms");
  await expect(customize).toHaveCount(0);
  await expect(root).toHaveAttribute("data-app-theme", "keio");

  await page.goto("/profile");
  await expect(customize).toHaveCount(1);
  await page.goto("/company");
  await expect(customize).toHaveCount(0);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await customize.click();
  const panel = page.locator("#theme-customizer");
  const navigation = page.getByRole("navigation", { name: "主要画面" });
  await expect(panel).toBeVisible();
  const panelBox = await panel.boundingBox();
  const navigationBox = await navigation.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(375);
  expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(navigationBox!.y);
});

test("group discussion practice flow works in mock mode", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "その他" }).click();
  await page
    .getByRole("menuitem", { name: "グループディスカッション" })
    .click();
  await expect(
    page.getByRole("heading", { name: "グループディスカッション" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "練習を始める" }).click();
  await expect(page.getByRole("heading", { name: "発言ログ" })).toBeVisible();

  await page
    .getByLabel("発話を入力")
    .fill("まず前提を整理して、評価基準を決めませんか。");
  await page.getByRole("button", { name: "発話を追加" }).click();
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "まず前提を整理して、評価基準を決めませんか。" }),
  ).toBeVisible();
  await expect(page.getByText("AI 標準")).toBeVisible();

  await page.getByRole("button", { name: "終了して採点" }).click();
  await expect(page.getByText("採点レポートを保存しました。")).toBeVisible();
  await page.getByRole("link", { name: /結果を見る/ }).click();
  await expect(
    page.getByRole("heading", { name: "GD採点レポート" }),
  ).toBeVisible();

  await page.goto("/group-discussion/history");
  await expect(page.getByText("地方自治体の若年層流出")).toBeVisible();
});
