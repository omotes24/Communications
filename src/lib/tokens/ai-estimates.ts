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
import {
  calculateAppTokens,
  estimateTextTokens,
  type AiFeature,
} from "@/lib/tokens/usage";

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
    1800,
    1,
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
    700,
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
    ].join("\n"),
    2400,
  );
}

function estimateForText(
  feature: AiFeature,
  input: string,
  maxOutputTokens: number,
  webSearchCalls = 0,
): number {
  void feature;
  return calculateAppTokens({
    inputTokens: estimateTextTokens(input),
    outputTokens: maxOutputTokens,
    webSearchCalls,
  });
}
