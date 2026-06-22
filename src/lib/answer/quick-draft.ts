import type {
  AnswerDraft,
  CompanyProfile,
  QuestionCategory,
  UserProfile,
} from "@/lib/schemas/interview";

export const quickDraftDelayMs = 3000;

function compactText(
  value: string | undefined | null,
  fallback: string,
): string {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }
  return Array.from(normalized).slice(0, 90).join("");
}

function firstAvailable(...values: Array<string | undefined | null>): string {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

function categoryOpening(category: QuestionCategory): string {
  if (category === "motivation") {
    return "志望理由としては";
  }
  if (category === "introduction") {
    return "自己紹介としては";
  }
  if (category === "strength") {
    return "私の強みとしては";
  }
  if (category === "weakness") {
    return "私の課題としては";
  }
  if (category === "failure") {
    return "挫折経験としては";
  }
  return "結論から言うと";
}

export function buildQuickAnswerDraft({
  question,
  category,
  profile,
  company,
  learningBrief,
}: {
  question: string;
  category: QuestionCategory;
  profile: UserProfile | null;
  company: CompanyProfile | null;
  learningBrief: string;
}): AnswerDraft {
  const companyName = compactText(
    firstAvailable(company?.companyName, company?.label),
    "応募先企業",
  );
  const targetRole = compactText(
    firstAvailable(company?.targetRole, company?.researchInstruction),
    "志望コース",
  );
  const selfCore = compactText(
    firstAvailable(
      profile?.careerSummary,
      profile?.achievements,
      profile?.successStories,
      profile?.strengths,
      learningBrief,
    ),
    "登録済みの経験",
  );
  const companyCore = compactText(
    firstAvailable(
      company?.researchSummary,
      company?.attraction,
      company?.business,
      company?.interviewFocus,
      learningBrief,
    ),
    `${companyName}で求められる役割`,
  );
  const strength = compactText(
    firstAvailable(profile?.strengths, profile?.skills, profile?.careerSummary),
    "課題を整理して実行まで進める力",
  );
  const opening = categoryOpening(category);

  const answer = `${opening}、私は${selfCore}を通じて培った経験を、${companyName}の${targetRole}で活かしたいと考えています。特に${strength}を強みとして、相手の課題を把握し、必要な情報を整理して形にすることを大切にしてきました。御社については${companyCore}に接点を感じており、入社後も現場の目的に沿って考え、周囲と連携しながら具体的な成果につなげたいです。`;

  return {
    question,
    talkingPoints: [
      `${selfCore}を結論の根拠にする`,
      `${companyName}の${targetRole}との接点を話す`,
      `${strength}を入社後の貢献に接続する`,
    ],
    answer,
    evidenceUsed: [
      profile?.careerSummary ? "自分のプロフィール" : "",
      profile?.strengths ? "強み" : "",
      company?.companyName ? "会社名" : "",
      company?.targetRole ? "志望コース" : "",
      learningBrief ? "面接前理解メモ" : "",
    ].filter(Boolean),
    missingInformation: [],
    caution:
      "3秒ルールによる暫定回答です。LLM生成が完了すると自動更新されます。",
  };
}
