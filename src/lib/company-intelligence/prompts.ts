import type { CompanyIntelligenceResearchRequest } from "@/lib/company-intelligence/schemas";

export function buildDeepResearchPrompt(
  request: CompanyIntelligenceResearchRequest,
): string {
  const urls = request.urls.length
    ? request.urls.map((url, index) => `${index + 1}. ${url}`).join("\n")
    : "URL未指定。企業名から公開情報を調査する。";

  return [
    "あなたは日本の就職・転職面接に詳しい企業研究アナリストです。",
    "目的は、面接準備に使える企業研究を、根拠付きで作ることです。",
    "事実と推定を必ず分けてください。根拠が弱い情報は断定しないでください。",
    "給与、勤務地、配属、選考、待遇、採用人数、リモート可否などの重要情報は、明確な根拠がない限り「要確認」にしてください。",
    "",
    `企業名: ${request.companyName || "未指定"}`,
    `応募職種: ${request.jobTitle || "未指定"}`,
    `価値観プリセット: ${request.interest}`,
    "",
    "調査URL:",
    urls,
    "",
    "ユーザーの自己情報:",
    request.selfInfo || "未登録",
    "",
    "出力では以下を整理してください。",
    "- 確認できた情報: 根拠URLつきの事実のみ",
    "- AI推定: 根拠から推測できるが断定できない仮説",
    "- 要確認: 公開情報だけでは確認できない点",
    "- 情報源: 参照したURL",
    "- 調査上の制約",
  ].join("\n");
}

export function buildNormalizationPrompt(
  request: CompanyIntelligenceResearchRequest,
  rawResearch: string,
): string {
  return [
    "以下のDeep Research結果を、指定されたJSONスキーマへ変換してください。",
    "重要: スキーマ上の checkedFacts は、必ず sourceUrls を1件以上持つ事実だけにしてください。",
    "根拠URLがない内容は checkedFacts に入れず、aiInferences または unknowns または unverifiedClaims に入れてください。",
    "架空のURL、架空の会社情報、未確認の待遇・選考情報を作らないでください。",
    "sourceUrls は入力URLまたは調査結果に含まれる公開URLだけを使ってください。",
    "",
    `企業名: ${request.companyName || "未指定"}`,
    `応募職種: ${request.jobTitle || "未指定"}`,
    `入力URL: ${request.urls.join(", ") || "なし"}`,
    "",
    "Deep Research結果:",
    rawResearch || "調査結果なし",
  ].join("\n");
}
