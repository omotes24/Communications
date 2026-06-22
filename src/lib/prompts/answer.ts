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
];

function formatSection<T extends Record<string, string>>(
  title: string,
  data: T | null,
  labels: Array<[keyof T, string]>,
): string {
  if (!data) {
    return `${title}: 未登録`;
  }
  const lines = labels
    .map(([key, label]) => {
      const value = data[key]?.trim();
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
    "あなたは日本語の面接練習コーチです。",
    "ユーザーが登録した経歴、実績、スキル、応募企業情報だけを根拠として回答案を作成してください。",
    "",
    "ルール:",
    "1. 登録情報にない職歴、資格、成果、数値、役職、経験を創作しない",
    "2. 根拠が足りない場合は、断定せず missingInformation へ不足事項を入れる",
    "3. 回答は原則として結論から始める",
    "4. 経験を問われた場合は STAR 形式を参考にする",
    "5. 自然な話し言葉の日本語にする",
    "6. 過度に完璧な回答や不自然な美辞麗句を避ける",
    "7. 質問に直接答える",
    "8. 原則250〜350文字に収める",
    "9. 同じ情報を繰り返さない",
    "10. 他人になりすました回答を作らない",
    "11. evidenceUsed には回答作成に使ったユーザー情報を列挙する",
    "12. 根拠がない場合は、もっともらしい内容で補完しない",
  ].join("\n");
}

export function buildAnswerInput(request: GenerateAnswerRequest): string {
  return [
    `質問: ${request.question}`,
    `分類: ${request.category}`,
    "",
    buildEvidenceBlock(request.profile, request.company),
  ].join("\n");
}
