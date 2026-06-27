import { z } from "zod";

export const groupDiscussionModeSchema = z.enum(["solo", "ai-participants"]);
export type GroupDiscussionMode = z.infer<typeof groupDiscussionModeSchema>;

export const groupDiscussionStatusSchema = z.enum([
  "setup",
  "active",
  "completed",
]);
export type GroupDiscussionStatus = z.infer<
  typeof groupDiscussionStatusSchema
>;

export const groupDiscussionParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  stance: z.string(),
  type: z.enum(["user", "ai", "observer"]).default("ai"),
});
export type GroupDiscussionParticipant = z.infer<
  typeof groupDiscussionParticipantSchema
>;

export const groupDiscussionUtteranceAnalysisSchema = z.object({
  summary: z.string(),
  isQuestion: z.boolean(),
  connectsToPrevious: z.boolean(),
  progress: z.enum(["advance", "neutral", "regress"]),
  issueOrganization: z.boolean(),
  interruptionRisk: z.boolean(),
  conclusionContribution: z.boolean(),
  timeManagement: z.boolean(),
  evidence: z.array(z.string()).default([]),
});
export type GroupDiscussionUtteranceAnalysis = z.infer<
  typeof groupDiscussionUtteranceAnalysisSchema
>;

export const groupDiscussionUtteranceSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  speakerId: z.string(),
  speakerName: z.string(),
  speakerType: z.enum(["user", "ai", "observer"]),
  text: z.string().trim().min(1),
  source: z.enum(["text", "microphone", "tab-audio", "ai"]),
  startedAt: z.string(),
  endedAt: z.string(),
  durationSeconds: z.number().min(1),
  analysis: groupDiscussionUtteranceAnalysisSchema.nullable().default(null),
});
export type GroupDiscussionUtterance = z.infer<
  typeof groupDiscussionUtteranceSchema
>;

export const groupDiscussionMapNodeSchema = z.object({
  id: z.string(),
  type: z.enum([
    "topic",
    "assumption",
    "issue",
    "subissue",
    "criterion",
    "idea",
    "pros",
    "cons",
    "evidence",
    "risk",
    "unresolved",
    "agreement",
    "conclusion",
    "next",
  ]),
  label: z.string(),
  evidenceUtteranceIds: z.array(z.string()).default([]),
});
export type GroupDiscussionMapNode = z.infer<
  typeof groupDiscussionMapNodeSchema
>;

export const groupDiscussionMapEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string(),
});
export type GroupDiscussionMapEdge = z.infer<
  typeof groupDiscussionMapEdgeSchema
>;

export const groupDiscussionMapSchema = z.object({
  nodes: z.array(groupDiscussionMapNodeSchema),
  edges: z.array(groupDiscussionMapEdgeSchema),
});
export type GroupDiscussionMap = z.infer<typeof groupDiscussionMapSchema>;

export const groupDiscussionMetricSchema = z.object({
  score: z.number().min(0).max(100),
  value: z.number(),
  label: z.string(),
  evidenceUtteranceIds: z.array(z.string()).default([]),
  comment: z.string(),
});
export type GroupDiscussionMetric = z.infer<
  typeof groupDiscussionMetricSchema
>;

export const groupDiscussionMetricsSchema = z.object({
  speakingTimeSeconds: groupDiscussionMetricSchema,
  utteranceCount: groupDiscussionMetricSchema,
  questionCount: groupDiscussionMetricSchema,
  connectionToOthers: groupDiscussionMetricSchema,
  discussionProgress: groupDiscussionMetricSchema,
  issueOrganization: groupDiscussionMetricSchema,
  interruptionRisk: groupDiscussionMetricSchema,
  conclusionContribution: groupDiscussionMetricSchema,
  timeManagement: groupDiscussionMetricSchema,
});
export type GroupDiscussionMetrics = z.infer<
  typeof groupDiscussionMetricsSchema
>;

export const groupDiscussionFinalEvaluationSchema = z.object({
  totalScore: z.number().min(0).max(100),
  summary: z.string(),
  strengths: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      evidenceUtteranceIds: z.array(z.string()).min(1),
    }),
  ),
  improvements: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      nextAction: z.string(),
      evidenceUtteranceIds: z.array(z.string()).min(1),
    }),
  ),
  nextPractice: z.array(z.string()),
});
export type GroupDiscussionFinalEvaluation = z.infer<
  typeof groupDiscussionFinalEvaluationSchema
>;

export const groupDiscussionSessionRecordSchema = z.object({
  id: z.string(),
  mode: groupDiscussionModeSchema,
  status: groupDiscussionStatusSchema,
  topic: z.string(),
  topicCategory: z.string(),
  durationMinutes: z.number().int().min(5).max(90),
  userRole: z.string(),
  participants: z.array(groupDiscussionParticipantSchema),
  utterances: z.array(groupDiscussionUtteranceSchema),
  discussionMap: groupDiscussionMapSchema,
  metrics: groupDiscussionMetricsSchema.nullable().default(null),
  finalEvaluation: groupDiscussionFinalEvaluationSchema.nullable().default(null),
  saveTranscript: z.boolean().default(true),
  createdAt: z.string(),
  startedAt: z.string().nullable().default(null),
  endedAt: z.string().nullable().default(null),
  updatedAt: z.string(),
});
export type GroupDiscussionSessionRecord = z.infer<
  typeof groupDiscussionSessionRecordSchema
>;

export const groupDiscussionTopicRequestSchema = z.object({
  category: z.string().trim().min(1).default("ビジネス"),
  difficulty: z.enum(["standard", "hard"]).default("standard"),
  companyContext: z.string().default(""),
  profileContext: z.string().default(""),
});
export type GroupDiscussionTopicRequest = z.infer<
  typeof groupDiscussionTopicRequestSchema
>;

export const groupDiscussionTopicOutputSchema = z.object({
  topic: z.string(),
  category: z.string(),
  assumptions: z.array(z.string()),
  expectedIssues: z.array(z.string()),
});
export type GroupDiscussionTopicOutput = z.infer<
  typeof groupDiscussionTopicOutputSchema
>;

export const groupDiscussionAiTurnRequestSchema = z.object({
  session: groupDiscussionSessionRecordSchema,
});
export type GroupDiscussionAiTurnRequest = z.infer<
  typeof groupDiscussionAiTurnRequestSchema
>;

export const groupDiscussionAiTurnDraftSchema = z.object({
  speakerId: z.string(),
  text: z.string().trim().min(1),
});
export type GroupDiscussionAiTurnDraft = z.infer<
  typeof groupDiscussionAiTurnDraftSchema
>;

export const groupDiscussionAiTurnOutputSchema = z.object({
  utterance: groupDiscussionUtteranceSchema,
});
export type GroupDiscussionAiTurnOutput = z.infer<
  typeof groupDiscussionAiTurnOutputSchema
>;

export const groupDiscussionFinalizeRequestSchema = z.object({
  session: groupDiscussionSessionRecordSchema,
});
export type GroupDiscussionFinalizeRequest = z.infer<
  typeof groupDiscussionFinalizeRequestSchema
>;

export const groupDiscussionFinalizeOutputSchema = z.object({
  metrics: groupDiscussionMetricsSchema,
  discussionMap: groupDiscussionMapSchema,
  finalEvaluation: groupDiscussionFinalEvaluationSchema,
});
export type GroupDiscussionFinalizeOutput = z.infer<
  typeof groupDiscussionFinalizeOutputSchema
>;
