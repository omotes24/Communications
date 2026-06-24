import type { LearnInterviewContextRequest } from "@/lib/schemas/interview";
import { buildEvidenceBlock } from "@/lib/prompts/answer";

export const INTERVIEW_LEARNING_INSTRUCTIONS = [
  "あなたは日本語面接の直前準備コーチです。",
  "ユーザーの自己情報、企業調査メモ、志望コース、その他メモを読み、以後の回答案生成に使える理解メモを作ってください。",
  "事実を創作せず、登録情報にある内容だけを材料にしてください。",
  "出力は指定されたJSON schemaに厳密に従ってください。",
].join("\n");

export function buildInterviewLearningInput(
  request: LearnInterviewContextRequest,
): string {
  return [
    "面接前に、以下の情報を理解して回答方針へ整理してください。",
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
