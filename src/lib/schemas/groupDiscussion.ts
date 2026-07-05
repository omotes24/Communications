import { z } from "zod";

export const groupDiscussionModeSchema = z.enum(["solo", "ai-participants"]);
export type GroupDiscussionMode = z.infer<typeof groupDiscussionModeSchema>;

export const gdPracticeModeSchema = z.enum([
  "guided",
  "realistic",
  "pressure",
  "one_person_drill",
]);
export type GDPracticeMode = z.infer<typeof gdPracticeModeSchema>;

export const gdTopicTypeSchema = z.enum([
  "problem_solving",
  "prioritization",
  "new_business",
  "marketing",
  "public_policy",
  "industry_case",
  "abstract",
  "debate",
  "document_based",
]);
export type GDTopicType = z.infer<typeof gdTopicTypeSchema>;

export const gdPersonaSchema = z.enum([
  "balanced",
  "quiet",
  "dominant",
  "logical",
  "off_topic",
  "agreeable",
  "skeptical",
  "time_keeper",
]);
export type GDPersona = z.infer<typeof gdPersonaSchema>;

export const gdEvaluationFocusSchema = z.enum([
  "logical_thinking",
  "facilitation",
  "collaboration",
  "summarization",
  "decision_making",
  "presentation",
  "company_fit",
]);
export type GDEvaluationFocus = z.infer<typeof gdEvaluationFocusSchema>;

export const gdPhaseSchema = z.enum([
  "intro",
  "define",
  "diverge",
  "analyze",
  "converge",
  "present",
  "review",
]);
export type GDPhase = z.infer<typeof gdPhaseSchema>;

export const gdSpeechTagSchema = z.enum([
  "premise_setting",
  "definition",
  "opinion",
  "reason",
  "question",
  "summary",
  "facilitation",
  "inclusion",
  "disagreement",
  "agreement",
  "decision",
  "risk",
  "example",
  "off_topic",
  "vague",
  "repetition",
  "time_management",
  "closing",
]);
export type GDSpeechTag = z.infer<typeof gdSpeechTagSchema>;

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
  persona: gdPersonaSchema.optional(),
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
  tags: z.array(gdSpeechTagSchema).default([]),
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

export const gdEvaluationScoreSchema = z.object({
  issue_definition: z.number().min(1).max(5),
  logical_thinking: z.number().min(1).max(5),
  contribution: z.number().min(1).max(5),
  collaboration: z.number().min(1).max(5),
  listening_summary: z.number().min(1).max(5),
  decision_making: z.number().min(1).max(5),
  time_management: z.number().min(1).max(5),
  output_quality: z.number().min(1).max(5),
  presentation: z.number().min(1).max(5),
  company_fit: z.number().min(1).max(5),
});
export type GDEvaluationScore = z.infer<typeof gdEvaluationScoreSchema>;

export const groupDiscussionFinalEvaluationSchema = z.object({
  totalScore: z.number().min(0).max(100),
  summary: z.string(),
  passPossibility: z.enum(["high", "medium", "low"]),
  scores: gdEvaluationScoreSchema,
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([]),
  evidence: z
    .array(
      z.object({
        quote: z.string(),
        comment: z.string(),
        relatedScoreKey: gdEvaluationScoreSchema.keyof(),
      }),
    )
    .default([]),
  goodQuotes: z.array(z.string()).default([]),
  improvementQuotes: z.array(z.string()).default([]),
  improvedPhrases: z
    .array(
      z.object({
        original: z.string(),
        improved: z.string(),
        reason: z.string(),
      }),
    )
    .default([]),
  recommendedDrills: z.array(z.string()).default([]),
  improvedPresentation: z.string().default(""),
  nextPractice: z.array(z.string()).default([]),
});
export type GroupDiscussionFinalEvaluation = z.infer<
  typeof groupDiscussionFinalEvaluationSchema
>;
export type GDEvaluationReport = GroupDiscussionFinalEvaluation;

export const gdTopicDetailsSchema = z.object({
  title: z.string().default(""),
  background: z.string().default(""),
  constraints: z.array(z.string()).default([]),
  deliverable: z.string().default(""),
  evaluationFocus: z.array(z.string()).default([]),
  suggestedTimeAllocation: z.array(z.string()).default([]),
  sampleGoodDirection: z.string().default(""),
  commonTraps: z.array(z.string()).default([]),
  assumedCompanyOrIndustry: z.string().default(""),
});
export type GDTopicDetails = z.infer<typeof gdTopicDetailsSchema>;

export const gdPhaseHistoryItemSchema = z.object({
  phase: gdPhaseSchema,
  startedAt: z.string(),
  endedAt: z.string().nullable().default(null),
});
export type GDPhaseHistoryItem = z.infer<typeof gdPhaseHistoryItemSchema>;

export const groupDiscussionSessionRecordSchema = z.object({
  id: z.string(),
  mode: groupDiscussionModeSchema,
  practiceMode: gdPracticeModeSchema.default("realistic"),
  status: groupDiscussionStatusSchema,
  topic: z.string(),
  topicCategory: z.string(),
  topicType: gdTopicTypeSchema.default("problem_solving"),
  difficulty: z.enum(["standard", "hard"]).default("standard"),
  durationMinutes: z.number().int().min(5).max(90),
  userRole: z.string(),
  participants: z.array(groupDiscussionParticipantSchema),
  aiParticipantCount: z.number().int().min(0).max(5).default(2),
  aiPersonas: z.array(gdPersonaSchema).default(["balanced", "logical"]),
  evaluationFocus: z
    .array(gdEvaluationFocusSchema)
    .default(["logical_thinking", "facilitation", "decision_making"]),
  profileSlotIds: z.array(z.string()).default([]),
  companySlotIds: z.array(z.string()).default([]),
  topicDetails: gdTopicDetailsSchema.default({
    title: "",
    background: "",
    constraints: [],
    deliverable: "",
    evaluationFocus: [],
    suggestedTimeAllocation: [],
    sampleGoodDirection: "",
    commonTraps: [],
    assumedCompanyOrIndustry: "",
  }),
  currentPhase: gdPhaseSchema.default("intro"),
  phaseHistory: z.array(gdPhaseHistoryItemSchema).default([]),
  whiteboardNotes: z.string().default(""),
  finalAnswer: z.string().default(""),
  presentationText: z.string().default(""),
  recommendedDrills: z.array(z.string()).default([]),
  estimatedTokenRange: z
    .object({
      min: z.number().int().nonnegative(),
      max: z.number().int().nonnegative(),
    })
    .nullable()
    .default(null),
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
  topicType: gdTopicTypeSchema.default("problem_solving"),
  durationMinutes: z.number().int().min(5).max(90).default(20),
  practiceMode: gdPracticeModeSchema.default("realistic"),
  evaluationFocus: z.array(gdEvaluationFocusSchema).default([]),
  companyContext: z.string().default(""),
  profileContext: z.string().default(""),
});
export type GroupDiscussionTopicRequest = z.infer<
  typeof groupDiscussionTopicRequestSchema
>;

export const groupDiscussionTopicOutputSchema = z.object({
  title: z.string(),
  topic: z.string(),
  topic_type: gdTopicTypeSchema.default("problem_solving"),
  difficulty: z.enum(["standard", "hard"]).default("standard"),
  assumed_company_or_industry: z.string().default(""),
  background: z.string().default(""),
  constraints: z.array(z.string()).default([]),
  deliverable: z.string().default(""),
  evaluation_focus: z.array(z.string()).default([]),
  suggested_time_allocation: z.array(z.string()).default([]),
  sample_good_direction: z.string().default(""),
  common_traps: z.array(z.string()).default([]),
  category: z.string(),
  assumptions: z.array(z.string()),
  expectedIssues: z.array(z.string()),
});
export type GroupDiscussionTopicOutput = z.infer<
  typeof groupDiscussionTopicOutputSchema
>;

export const groupDiscussionAiTurnRequestSchema = z.object({
  session: groupDiscussionSessionRecordSchema,
  currentPhase: gdPhaseSchema.optional(),
  remainingSeconds: z.number().int().nonnegative().optional(),
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
  finalAnswer: z.string().optional(),
  presentationText: z.string().optional(),
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
