import type { ClassifyQuestionRequest } from "@/lib/schemas/interview";

export function buildQuestionClassifierInput(
  request: ClassifyQuestionRequest,
): string {
  return [
    "次の発話が、面接または同意済み会話で回答を求める質問か判定してください。",
    "相づち、雑談、不完全な文字起こし、自分側の発話は質問として扱わないでください。",
    "自己紹介依頼、経験説明依頼、具体例要求、深掘り要求は質問として扱ってください。",
    "",
    `speaker: ${request.speaker}`,
    `source: ${request.source}`,
    `transcript: ${request.transcript}`,
  ].join("\n");
}

export const QUESTION_CLASSIFIER_INSTRUCTIONS = [
  "あなたは日本語の面接・会話支援アプリの質問判定器です。",
  "出力は指定された JSON schema に厳密に従ってください。",
  "speaker が local の場合は isQuestion=false にしてください。",
  "質問本文は、文字起こしのノイズを最小限に整えた日本語にしてください。",
].join("\n");
