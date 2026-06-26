import type { LearnInterviewContextRequest } from "@/lib/schemas/interview";
import { buildEvidenceBlock } from "@/lib/prompts/answer";

export function buildInterviewLearningInstructions(
  language: LearnInterviewContextRequest["learningLanguage"] = "ja",
): string {
  const baseRules = [
    "あなたは面接の直前準備コーチです。",
    "ユーザーの自己情報、企業調査メモ、志望コース、その他メモを読み、以後の回答案生成に使える理解メモを作ってください。",
    "事実を創作せず、登録情報にある内容だけを材料にしてください。",
    "出力は指定されたJSON schemaに厳密に従ってください。",
  ];

  if (language === "en") {
    return [
      ...baseRules,
      "英語面接用の学習メモとして、brief、keyPoints、caution は自然な英語で書いてください。",
      "日本語の登録情報は意味を保って英語面接で使える方針に変換してください。",
      "回答生成時にそのまま参照できるよう、英語で話すときの表現方針、強調すべき経験、避けるべき断定を整理してください。",
    ].join("\n");
  }

  return [
    ...baseRules,
    "日本語面接用の学習メモとして、brief、keyPoints、caution は自然な日本語で書いてください。",
  ].join("\n");
}

export const INTERVIEW_LEARNING_INSTRUCTIONS =
  buildInterviewLearningInstructions();

export function buildInterviewLearningInput(
  request: LearnInterviewContextRequest,
): string {
  return [
    "面接前に、以下の情報を理解して回答方針へ整理してください。",
    `学習メモの出力言語: ${request.learningLanguage === "en" ? "English" : "日本語"}`,
    "",
    buildEvidenceBlock(request.profile, request.company),
    "",
    `自分スロット追加メモ: ${request.selfInfo || "なし"}`,
    `志望コース: ${request.desiredCourse || request.company?.targetRole || "未指定"}`,
    `その他: ${request.additionalNotes || "なし"}`,
    "",
    "briefには、回答生成時に常に参照すべき面接方針を自然文でまとめてください。",
    "keyPointsには、面接で優先して使う根拠や切り口を列挙してください。",
    "cautionには、断定してはいけないことや不足情報があれば書いてください。",
  ].join("\n");
}
