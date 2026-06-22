import type {
  AnswerDraft,
  ClassifyQuestionRequest,
  GenerateAnswerRequest,
  QuestionClassification,
} from "@/lib/schemas/interview";

const questionTriggers = [
  "ですか",
  "ますか",
  "でしょうか",
  "教えて",
  "お願いします",
  "説明",
  "具体例",
  "詳しく",
  "?",
  "？",
];

export function mockClassifyQuestion(
  request: ClassifyQuestionRequest,
): QuestionClassification {
  if (request.speaker === "local") {
    return {
      isQuestion: false,
      confidence: 0.99,
      question: "",
      category: "other",
      requiresPersonalExample: false,
      reason: "自分側の発話なので自動生成対象外です",
    };
  }

  const isQuestion = questionTriggers.some((trigger) =>
    request.transcript.includes(trigger),
  );

  return {
    isQuestion,
    confidence: isQuestion ? 0.92 : 0.3,
    question: isQuestion ? request.transcript : "",
    category: request.transcript.includes("志望")
      ? "motivation"
      : request.transcript.includes("失敗")
        ? "failure"
        : request.transcript.includes("強み")
          ? "strength"
          : request.transcript.includes("自己紹介")
            ? "introduction"
            : "experience",
    requiresPersonalExample:
      request.transcript.includes("経験") ||
      request.transcript.includes("具体例") ||
      request.transcript.includes("実績"),
    reason: isQuestion
      ? "回答要求または質問表現を含んでいます"
      : "回答を求める発話ではありません",
  };
}

export function mockGenerateAnswer(
  request: GenerateAnswerRequest,
): AnswerDraft {
  const profile = request.profile;
  const company = request.company;
  const role = profile?.currentRole || "現在の職種";
  const strength = profile?.strengths || profile?.skills || "登録済みの強み";
  const achievement =
    profile?.achievements || profile?.successStories || "登録済みの実績";
  const companyName = company?.companyName || "応募先企業";
  const attraction = company?.attraction || company?.business || "事業内容";
  const previousTurn = request.conversationContext.at(-1);
  const conversationLead = previousTurn
    ? `先ほどの回答を踏まえると、`
    : "結論から言うと、";

  return {
    question: request.question,
    talkingPoints: [
      `${role}での経験を結論から伝える`,
      `${strength}を応募先の期待に接続する`,
      `${achievement}を根拠として簡潔に話す`,
    ],
    answer: `${conversationLead}私は${role}として培ってきた経験を、${companyName}で再現性のある成果につなげたいと考えています。特に${strength}を活かし、これまで${achievement}に取り組んできました。御社については${attraction}に魅力を感じており、入社後はまず現場理解を深めながら、求められる役割に対して具体的な改善提案と実行で貢献したいです。`,
    evidenceUsed: [
      profile?.currentRole ? `現在の職種: ${profile.currentRole}` : "",
      profile?.strengths ? `強み: ${profile.strengths}` : "",
      profile?.achievements ? `実績: ${profile.achievements}` : "",
      company?.companyName ? `会社名: ${company.companyName}` : "",
      company?.attraction ? `企業の魅力: ${company.attraction}` : "",
    ].filter(Boolean),
    missingInformation:
      profile && company ? [] : ["プロフィールまたは応募情報"],
    caution: null,
  };
}

export async function* streamMockAnswer(
  draft: AnswerDraft,
): AsyncGenerator<Partial<AnswerDraft>, void> {
  yield { talkingPoints: draft.talkingPoints };
  const chunkSize = 28;
  for (let index = chunkSize; index < draft.answer.length; index += chunkSize) {
    yield { answer: draft.answer.slice(0, index) };
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  yield draft;
}
