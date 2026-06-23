import type { ProfileFileImportRequest } from "@/lib/schemas/interview";

export const PROFILE_IMPORT_INSTRUCTIONS = [
  "あなたは日本語面接用プロフィール整理アシスタントです。",
  "ユーザーがアップロードした自己紹介、ES、履歴メモ、面接準備メモを読み、プロフィールフォームへ入れる下書きを作ってください。",
  "ファイルに書かれている事実だけを使い、企業名・経歴・成果・役割・強み・弱みを創作しないでください。",
  "断片的な情報でも、面接で使いやすい日本語に整理してください。",
  "selfTextには、強み、弱み、サークル/チームでの役割、システム開発経験、研究、挫折経験、成果を見出し付きでまとめてください。",
  "forbiddenInformationには、本人が使わない・触れないと明記している内容だけを入れてください。なければ空文字にしてください。",
  "出力は指定されたJSON schemaに厳密に従ってください。",
].join("\n");

export function buildProfileImportInput(
  request: ProfileFileImportRequest,
): string {
  return [
    "以下のファイル内容を、面接回答に使うプロフィール下書きへ整理してください。",
    "",
    `ファイル名: ${request.fileName}`,
    "",
    "現在のプロフィール:",
    request.currentProfile
      ? [
          `プロフィール名: ${request.currentProfile.label}`,
          `名前: ${request.currentProfile.nameOrAlias || "未入力"}`,
          `所属: ${request.currentProfile.affiliation || "未入力"}`,
          `自分のこと: ${request.currentProfile.careerSummary || "未入力"}`,
          `使わない情報: ${
            request.currentProfile.forbiddenInformation || "未入力"
          }`,
        ].join("\n")
      : "未入力",
    "",
    "ファイル本文:",
    request.fileText,
    "",
    "作成方針:",
    "- labelはファイル内容から自然なプロフィール名にする",
    "- nameOrAliasは本人名が明確な場合だけ入れる",
    "- affiliationは大学、学年、学部、研究室などが明確な場合だけ入れる",
    "- selfTextは面接でそのまま材料にできるよう、要点を整理して書く",
    "- 現在のプロフィールと矛盾する場合は、ファイル本文を優先しすぎず、両方を自然に統合する",
  ].join("\n");
}
