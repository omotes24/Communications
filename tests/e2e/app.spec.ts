import { expect, test } from "@playwright/test";

test("manual question flow with mock AI", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());

  await page.goto("/profile");
  await page.getByLabel("名前").fill("表 太郎");
  await page
    .getByLabel("在籍している大学・学年・学部・研究室など")
    .fill("慶應義塾大学 理工学部 4年 中澤・大越研究室");
  await page
    .getByLabel("自分のこと")
    .fill(
      "強み: 顧客課題を構造化してチームを前進させる力\n実績: オンボーディング改善で解約率を下げた",
    );
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("メインプロフィール")).toBeVisible();

  await page.goto("/company");
  await page.getByRole("button", { name: "自分のことを反映" }).click();
  await page.getByLabel("会社名").fill("サンプル株式会社");
  await page
    .getByLabel("企業Webサイト")
    .fill("https://sample.example.com/recruit");
  await page.getByLabel("志望コース").fill("プロダクト職 現場課題解決コース");
  await page.getByLabel("その他").fill("SatoFCの経験を中心に話したい");

  await page.goto("/support");
  await page.goto("/company");
  await expect(page.getByLabel("会社名")).toHaveValue("サンプル株式会社");
  await expect(page.getByLabel("企業Webサイト")).toHaveValue(
    "https://sample.example.com/recruit",
  );
  await expect(page.getByLabel("志望コース")).toHaveValue(
    "プロダクト職 現場課題解決コース",
  );

  await page.getByRole("button", { name: "学習用スロット作成" }).click();
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
  await expect(page.getByRole("heading", { name: "回答案" })).toBeVisible();

  await page.getByRole("button", { name: "履歴に保存" }).click();
  await page.goto("/history");
  await expect(
    page.getByText("これまでの経験について教えてください。"),
  ).toBeVisible();

  await page.goto("/privacy");
  await page.getByRole("button", { name: "すべてのデータを削除" }).click();
  await expect(page.getByText("プロフィール: 0件")).toBeVisible();
});
