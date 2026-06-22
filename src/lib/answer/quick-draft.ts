import type {
  AnswerDraft,
  AnswerConversationTurn,
  CompanyProfile,
  QuestionCategory,
  UserProfile,
} from "@/lib/schemas/interview";

export const quickDraftDelayMs = 1800;

type QuickIntent =
  | "motivation"
  | "introduction"
  | "strength"
  | "weakness"
  | "failure"
  | "research"
  | "experience"
  | "followUp"
  | "generic";

function compactText(
  value: string | undefined | null,
  fallback: string,
  maxLength = 72,
): string {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }
  return Array.from(normalized).slice(0, maxLength).join("");
}

function firstAvailable(...values: Array<string | undefined | null>): string {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

function includesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractQuestionFocus(question: string): string {
  const normalized = normalizeText(question);
  const parts = normalized
    .replace(/([。！？?？])/g, "$1\n")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const lastQuestionPart =
    [...parts]
      .reverse()
      .find((part) =>
        /[?？]|(?:ですか|ますか|でしょうか|理由|なぜ|どうして)/.test(part),
      ) ??
    parts.at(-1) ??
    normalized;
  return compactText(
    lastQuestionPart.replace(
      /^(では|それでは|続いて|ちなみに|ありがとうございます)[、,\s。]*/,
      "",
    ),
    normalized,
    86,
  );
}

function latestConversationTurn(
  conversationContext: AnswerConversationTurn[],
): AnswerConversationTurn | null {
  return conversationContext.at(-1) ?? null;
}

function resolveIntent(
  question: string,
  category: QuestionCategory,
): QuickIntent {
  if (
    category === "followUp" ||
    includesAny(question, [
      /その中で|先ほど|先程|今の|具体的|詳しく|深掘り|もう少し|なぜそう|どういう意味/,
    ])
  ) {
    return "followUp";
  }
  if (
    category === "motivation" ||
    includesAny(question, [/志望|応募|選ん|選ば|なぜ|どうして|他社|比べ|比較/])
  ) {
    return "motivation";
  }
  if (
    category === "introduction" ||
    includesAny(question, [/自己紹介|自己PR|あなたについて/])
  ) {
    return "introduction";
  }
  if (category === "strength" || includesAny(question, [/強み|長所/])) {
    return "strength";
  }
  if (category === "weakness" || includesAny(question, [/弱み|短所|課題/])) {
    return "weakness";
  }
  if (
    category === "failure" ||
    includesAny(question, [/挫折|失敗|苦労|困難|乗り越え/])
  ) {
    return "failure";
  }
  if (category === "technical" || includesAny(question, [/研究|開発|技術/])) {
    return "research";
  }
  if (
    category === "experience" ||
    category === "achievement" ||
    includesAny(question, [/経験|実績|成果|学生時代|ガクチカ|力を入れ/])
  ) {
    return "experience";
  }
  return "generic";
}

function buildAnswer({
  intent,
  selfCore,
  strength,
  weakness,
  failure,
  companyName,
  companyCore,
  targetRole,
  questionFocus,
  previousQuestion,
  previousAnswer,
}: {
  intent: QuickIntent;
  selfCore: string;
  strength: string;
  weakness: string;
  failure: string;
  companyName: string;
  companyCore: string;
  targetRole: string;
  questionFocus: string;
  previousQuestion: string;
  previousAnswer: string;
}): string {
  if (intent === "followUp") {
    const followUpTarget = previousQuestion
      ? `「${previousQuestion}」への回答`
      : "先ほどの回答";
    return `${followUpTarget}に補足すると、${previousAnswer || selfCore}という点で、単に経験を積んだだけでなく、相手の状況に合わせて行動を変えたことが大きかったです。${questionFocus}については、課題を自分だけで抱えず、早い段階で関係者と認識を合わせた点が重要でした。その姿勢を${companyName}でも活かし、再現性を持って成果につなげたいです。`;
  }
  if (intent === "motivation") {
    return `${companyName}を志望する理由は、${companyCore}に対して、私の${selfCore}で培った力を最も活かせると感じているからです。他社と比べても、${targetRole}として現場の課題を捉え、関係者と形にする経験を直接つなげられる点に魅力があります。入社後は${strength}を活かし、課題発見から実行まで責任を持って貢献したいです。`;
  }
  if (intent === "introduction") {
    return `私は、${selfCore}を中心に、課題を見つけて実装までやり切る経験を重ねてきました。特に大切にしているのは、技術や行動を目的化せず、相手が実際に使える形まで落とし込むことです。${strength}を強みとして、入社後も${companyName}の${targetRole}で周囲と連携しながら成果につなげたいです。`;
  }
  if (intent === "strength") {
    return `私の強みは、${strength}です。${selfCore}の中でも、最初から答えが見えていたわけではありませんが、現場の課題を聞き取り、必要な情報を整理し、検証と改善を重ねて形にしてきました。入社後もこの強みを活かし、${companyName}の${targetRole}として課題を前に進める役割を担いたいです。`;
  }
  if (intent === "weakness") {
    return `私の弱みは、${weakness}です。一方で、粘り強く取り組む姿勢自体は強みでもあるため、現在は早い段階で仮説や進捗を共有し、周囲から意見をもらいながら進めることを意識しています。入社後も一人で抱え込まず、目的と状況を共有しながら、チームで成果を出せる行動に変えていきたいです。`;
  }
  if (intent === "failure") {
    return `挫折や苦労を通じて学んだのは、正しさを主張するだけでは物事は進まないということです。${failure}の経験では、相手の不安や前提を理解し、必要な情報を整理して信頼を積み重ねることを意識しました。その結果、状況を前に進めることができ、今も周囲を巻き込む際の行動基準になっています。`;
  }
  if (intent === "research") {
    return `現在力を入れているのは、${selfCore}です。単に精度の高い仕組みを作るだけでなく、実際の現場で安全に使える状態まで持っていくことを重視しています。研究や開発では、未知の入力や誤判定のリスクまで考え、改善を重ねてきました。入社後も${targetRole}として、技術を価値につなげる姿勢で貢献したいです。`;
  }
  if (intent === "experience") {
    return `学生時代に力を入れたのは、${selfCore}です。現場の課題を聞き取り、必要な機能や運用を整理しながら、実際に使える形まで進めました。特に意識したのは、成果物を作って終わりにせず、相手が判断に使える状態にすることです。この経験で培った${strength}を、${companyName}でも活かしたいです。`;
  }
  return `結論から言うと、私は${selfCore}で培った経験を、${companyName}の${targetRole}で活かしたいと考えています。特に${strength}を強みとして、課題を整理し、関係者と連携しながら形にすることを大切にしてきました。入社後も、目の前の課題に対して主体的に考え、実行まで責任を持って貢献したいです。`;
}

export function buildQuickAnswerDraft({
  question,
  category,
  profile,
  company,
  learningBrief,
  conversationContext = [],
}: {
  question: string;
  category: QuestionCategory;
  profile: UserProfile | null;
  company: CompanyProfile | null;
  learningBrief: string;
  conversationContext?: AnswerConversationTurn[];
}): AnswerDraft {
  const companyName = compactText(
    firstAvailable(company?.companyName, company?.label),
    "御社",
    36,
  );
  const targetRole = compactText(
    firstAvailable(company?.targetRole, company?.researchInstruction),
    "志望職種",
    48,
  );
  const selfCore = compactText(
    firstAvailable(
      profile?.careerSummary,
      profile?.achievements,
      profile?.successStories,
      profile?.skills,
      learningBrief,
    ),
    "課題を見つけ、周囲を巻き込みながら形にしてきた経験",
    82,
  );
  const companyCore = compactText(
    firstAvailable(
      company?.researchSummary,
      company?.attraction,
      company?.business,
      company?.interviewFocus,
      learningBrief,
    ),
    "現場の課題に向き合い、価値をつくる姿勢",
    82,
  );
  const strength = compactText(
    firstAvailable(profile?.strengths, profile?.skills, profile?.careerSummary),
    "粘り強くやり切り、課題を実行に移す力",
    58,
  );
  const weakness = compactText(
    profile?.weaknesses,
    "一人で抱え込みすぎてしまう点",
    54,
  );
  const failure = compactText(
    firstAvailable(profile?.failureStories, profile?.careerSummary),
    "物事を前に進める難しさに向き合った",
    72,
  );
  const questionFocus = extractQuestionFocus(question);
  const previousTurn = latestConversationTurn(conversationContext);
  const previousQuestion = compactText(previousTurn?.question, "", 70);
  const previousAnswer = compactText(previousTurn?.answer, "", 92);
  const intent = resolveIntent(question, category);
  const answer = buildAnswer({
    intent,
    selfCore,
    strength,
    weakness,
    failure,
    companyName,
    companyCore,
    targetRole,
    questionFocus,
    previousQuestion,
    previousAnswer,
  });

  return {
    question,
    talkingPoints: [
      "質問に対する結論を先に述べる",
      previousQuestion
        ? "直前の会話から一段具体化して話す"
        : "自分の経験を一つに絞って話す",
      "入社後の貢献まで接続する",
    ],
    answer,
    evidenceUsed: [],
    missingInformation: [],
    caution: null,
  };
}
