import type {
  ClassifyQuestionRequest,
  GenerateAnswerRequest,
  LearnInterviewContextRequest,
  ProfileFileImportRequest,
  ResearchCompanyRequest,
} from "@/lib/schemas/interview";
import type {
  GroupDiscussionAiTurnRequest,
  GroupDiscussionFinalizeRequest,
  GroupDiscussionTopicRequest,
} from "@/lib/schemas/groupDiscussion";
import type { SolveQuestionRequest } from "@/lib/question-solver/schemas";
import {
  calculateAppTokens,
  estimateTextTokens,
  type AiFeature,
} from "@/lib/tokens/usage";

export const COMPANY_RESEARCH_MAX_OUTPUT_TOKENS = 6_000;
export const INTERVIEW_LEARNING_MAX_OUTPUT_TOKENS = 3_000;

const COMPANY_RESEARCH_INPUT_HEADROOM_TOKENS = 3_000;
const INTERVIEW_LEARNING_INPUT_HEADROOM_TOKENS = 1_000;

export function estimateClassifyTokens(body: ClassifyQuestionRequest): number {
  return estimateForText("classify-question", body.transcript, 180);
}

export function estimateGenerateAnswerTokens(
  body: GenerateAnswerRequest,
): number {
  return estimateForText(
    "generate-answer",
    [
      body.question,
      body.profile ? JSON.stringify(body.profile) : "",
      body.company ? JSON.stringify(body.company) : "",
      body.profiles ? JSON.stringify(body.profiles) : "",
      body.companies ? JSON.stringify(body.companies) : "",
      body.learningBrief,
      JSON.stringify(body.conversationContext),
      body.selfSlot ?? "",
    ].join("\n"),
    body.answerLengthTarget ? Math.ceil(body.answerLengthTarget / 2) : 420,
  );
}

export function estimateResearchCompanyTokens(
  body: ResearchCompanyRequest,
): number {
  return estimateForText(
    "research-company",
    [
      body.selfInfo,
      body.companyName,
      body.companyWebsite,
      body.desiredCourse,
      body.additionalNotes,
    ].join("\n"),
    COMPANY_RESEARCH_MAX_OUTPUT_TOKENS,
    1,
    COMPANY_RESEARCH_INPUT_HEADROOM_TOKENS,
  );
}

export function estimateLearningTokens(
  body: LearnInterviewContextRequest,
): number {
  return estimateForText(
    "learn-interview-context",
    [
      body.profile ? JSON.stringify(body.profile) : "",
      body.company ? JSON.stringify(body.company) : "",
      body.selfInfo,
      body.desiredCourse,
      body.additionalNotes,
      body.learningLanguage,
    ].join("\n"),
    INTERVIEW_LEARNING_MAX_OUTPUT_TOKENS,
    0,
    INTERVIEW_LEARNING_INPUT_HEADROOM_TOKENS,
  );
}

export function estimateProfileImportTokens(
  body: ProfileFileImportRequest,
): number {
  return estimateForText(
    "import-profile-file",
    [body.fileName, body.fileText, JSON.stringify(body.currentProfile)].join(
      "\n",
    ),
    700,
  );
}

export function estimateAudioTokens(audio: File): {
  amount: number;
  audioSeconds: number;
} {
  const estimatedSeconds = Math.max(1, Math.ceil(audio.size / 16000));
  return {
    amount: calculateAppTokens({ audioSeconds: estimatedSeconds }),
    audioSeconds: estimatedSeconds,
  };
}

export function estimateRealtimeSessionTokens(seconds = 180): number {
  return calculateAppTokens({ audioSeconds: seconds });
}

export function estimateGroupDiscussionTopicTokens(
  body: GroupDiscussionTopicRequest,
): number {
  return estimateForText(
    "group-discussion",
    [
      body.category,
      body.difficulty,
      body.topicType,
      body.practiceMode,
      String(body.durationMinutes),
      JSON.stringify(body.evaluationFocus),
      body.companyContext,
      body.profileContext,
    ].join("\n"),
    700,
  );
}

export function estimateGroupDiscussionAiTurnTokens(
  body: GroupDiscussionAiTurnRequest,
): number {
  return estimateForText(
    "group-discussion",
    [
      body.session.topic,
      body.session.currentPhase,
      body.remainingSeconds === undefined ? "" : String(body.remainingSeconds),
      JSON.stringify(body.session.participants),
      JSON.stringify(body.session.utterances.slice(-8)),
    ].join("\n"),
    260,
  );
}

export function estimateGroupDiscussionFinalizeTokens(
  body: GroupDiscussionFinalizeRequest,
): number {
  return estimateForText(
    "group-discussion",
    [
      body.session.topic,
      JSON.stringify(body.session.participants),
      JSON.stringify(body.session.utterances),
      body.finalAnswer ?? body.session.finalAnswer,
      body.presentationText ?? body.session.presentationText,
    ].join("\n"),
    2400,
  );
}

export function estimateSolveQuestionTokens(
  body: SolveQuestionRequest,
): number {
  const imageTokenReserve = body.question.visualImageDataUrl ? 6000 : 0;
  return (
    estimateForText(
      "solve-question",
      [
        body.mode,
        body.question.subject,
        body.question.gradeLevel,
        body.question.answerType,
        body.question.passage ?? "",
        body.question.visualContext ?? "",
        body.question.stem,
        JSON.stringify(body.question.choices ?? []),
        JSON.stringify(body.question.mathLatex ?? []),
        body.question.rawText,
      ].join("\n"),
      body.mode === "answer_only" ? 500 : 1400,
    ) + imageTokenReserve
  );
}

function estimateForText(
  feature: AiFeature,
  input: string,
  maxOutputTokens: number,
  webSearchCalls = 0,
  inputTokenHeadroom = 0,
): number {
  void feature;
  return calculateAppTokens({
    inputTokens: estimateTextTokens(input) + inputTokenHeadroom,
    outputTokens: maxOutputTokens,
    webSearchCalls,
  });
}
