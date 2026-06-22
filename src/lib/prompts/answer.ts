import type {
  CompanyProfile,
  GenerateAnswerRequest,
  UserProfile,
} from "@/lib/schemas/interview";

const profileLabels: Array<[keyof UserProfile, string]> = [
  ["nameOrAlias", "氏名または呼称"],
  ["currentRole", "現在の職種"],
  ["careerSummary", "経歴概要"],
  ["workHistory", "職歴"],
  ["skills", "スキル"],
  ["strengths", "強み"],
  ["weaknesses", "弱み"],
  ["achievements", "実績"],
  ["metrics", "成果数値"],
  ["successStories", "成功経験"],
  ["failureStories", "失敗経験"],
  ["managementExperience", "マネジメント経験"],
  ["careerChangeReason", "転職理由"],
  ["motivationMaterials", "志望動機の素材"],
  ["preferredTone", "希望する話し方"],
  ["forbiddenInformation", "回答で絶対に使わない情報"],
];

const companyLabels: Array<[keyof CompanyProfile, string]> = [
  ["companyName", "会社名"],
  ["business", "事業内容"],
  ["philosophy", "企業理念"],
  ["targetRole", "応募職種"],
  ["jobDescription", "求人票"],
  ["requiredSkills", "求められるスキル"],
  ["interviewFocus", "面接で重視されそうな事項"],
  ["attraction", "ユーザーが感じている企業の魅力"],
  ["reverseQuestions", "逆質問候補"],
  ["researchSummary", "企業調査サマリー"],
];

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(" / ");
  }
  return typeof value === "string" ? value : "";
}

function formatSection<T extends object>(
  title: string,
  data: T | null,
  labels: Array<[keyof T, string]>,
  options: { suppressMissingLabel?: boolean } = {},
): string {
  if (!data) {
    return options.suppressMissingLabel
      ? `${title}: 面接前理解メモを優先して参照`
      : `${title}: 入力なし。近い登録情報と一般的な面接回答の型から自然に補う`;
  }
  const lines = labels
    .map(([key, label]) => {
      const value = formatValue(data[key]).trim();
      return value ? `- ${label}: ${value}` : null;
    })
    .filter(Boolean);
  return [`${title}:`, ...lines].join("\n");
}

export function buildEvidenceBlock(
  profile: UserProfile | null,
  company: CompanyProfile | null,
): string {
  return [
    formatSection("ユーザー登録情報", profile, profileLabels),
    formatSection("応募企業・求人情報", company, companyLabels),
  ].join("\n\n");
}

export function buildAnswerInstructions(): string {
  return [
    "あなたは日本語の面接回答コーチです。",
    "ユーザーが登録した経歴、実績、スキル、応募企業情報を芯にして、面接でそのまま話せる回答案を作成してください。",
    "",
    "ルール:",
    "1. どんな質問でも必ず回答本文を書く",
    "2. 登録情報が薄い場合も、自然な面接回答になる範囲で一般化して補う",
    "3. 回答は原則として結論から始める",
    "4. 経験を問われた場合は STAR 形式を参考にする",
    "5. 自然な話し言葉の日本語にする",
    "6. 過度に完璧な回答や不自然な美辞麗句を避ける",
    "7. 質問に直接答える",
    "8. 原則250〜350文字に収める",
    "9. 同じ情報を繰り返さない",
    "10. 他人になりすました回答を作らない",
    "11. 回答本文には、根拠不足、未登録、不足情報、推測であることを説明しない",
    "12. evidenceUsed と missingInformation は内部管理用として最小限にし、回答本文には出さない",
    "13. 捻った質問でも、登録情報から一番近い経験に接続して答える",
  ].join("\n");
}

export function buildAnswerInput(request: GenerateAnswerRequest): string {
  const hasLearningBrief = Boolean(request.learningBrief.trim());
  return [
    `質問: ${request.question}`,
    `分類: ${request.category}`,
    request.learningBrief
      ? `面接前理解メモ: ${request.learningBrief}`
      : "面接前理解メモ: 未作成",
    "",
    hasLearningBrief
      ? [
          formatSection("ユーザー登録情報", request.profile, profileLabels, {
            suppressMissingLabel: true,
          }),
          formatSection("応募企業・求人情報", request.company, companyLabels, {
            suppressMissingLabel: true,
          }),
        ].join("\n\n")
      : buildEvidenceBlock(request.profile, request.company),
  ].join("\n");
}
