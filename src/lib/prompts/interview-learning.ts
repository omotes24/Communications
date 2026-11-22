import type { LearnInterviewContextRequest } from "@/lib/schemas/interview";
import { buildMultiProfileEvidenceBlock } from "@/lib/prompts/answer";

export function buildInterviewLearningInstructions(
  language: LearnInterviewContextRequest["learningLanguage"] = "ja",
): string {
  const baseRules = [
    "あなたは面接の直前準備コーチです。",
    "ユーザーの自己情報、企業調査メモ、志望コース、その他メモを読み、以後の回答案生成に使える理解メモを作ってください。",
    "事実を創作せず、登録情報にある内容だけを材料にしてください。",
    "応募先は「応募企業・求人情報」に書かれた会社だけです。自分スロットに別の会社名（過去に準備した企業など）が含まれていても、その会社向けの方針や志望理由にしないでください。",
    "自分スロットに書かれた自己紹介・経験・強みを、この応募企業と志望コースにどうつながるかの形で整理してください。",
    "出力は指定されたJSON schemaに厳密に従ってください。",
  ];

  if (language === "en") {
    return [
      ...baseRules,
      "英語面接用の学習メモとして、brief、keyPoints、caution は自然な英語で書いてください。",
      "brief の最初の文で、応募企業名と志望コースを明示してください。",
      "日本語の登録情報は意味を保って英語面接で使える方針に変換してください。",
      "回答生成時にそのまま参照できるよう、英語で話すときの表現方針、強調すべき経験、避けるべき断定を整理してください。",
    ].join("\n");
  }

  return [
    ...baseRules,
    "日本語面接用の学習メモとして、brief、keyPoints、caution は自然な日本語で書いてください。",
    "brief の最初の文で、応募企業名と志望コースを明示してください。",
  ].join("\n");
}

export const INTERVIEW_LEARNING_INSTRUCTIONS =
  buildInterviewLearningInstructions();

type InterviewLearningPromptRequest = Omit<
  LearnInterviewContextRequest,
  "profiles"
> & {
  profiles?: LearnInterviewContextRequest["profiles"];
};

export function buildInterviewLearningInput(
  request: InterviewLearningPromptRequest,
): string {
  const profiles =
    request.profiles && request.profiles.length > 0
      ? request.profiles
      : request.profile
        ? [request.profile]
        : [];
  const companyName =
    request.company?.companyName || request.company?.label || "未指定";
  return [
    "面接前に、以下の情報を理解して回答方針へ整理してください。",
    `学習メモの出力言語: ${request.learningLanguage === "en" ? "English" : "日本語"}`,
    `応募企業: ${companyName}`,
    "",
    buildMultiProfileEvidenceBlock(profiles, request.company),
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
