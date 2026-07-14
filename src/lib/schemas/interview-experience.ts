import { z } from "zod";

export const jobtrackCatalogRefSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^JT\d{6}$/);

export const selectionStageSchema = z.enum([
  "screening",
  "first",
  "second",
  "final",
  "casual",
  "intern",
  "other",
]);

export const employmentTypeSchema = z.enum([
  "new_grad",
  "mid_career",
  "intern",
  "part_time",
  "other",
]);

export const interviewFormatSchema = z.enum([
  "one_on_one",
  "panel",
  "group",
  "video",
  "phone",
  "other",
]);

export const interviewQuestionSchema = z.object({
  question: z.string().trim().min(1).max(500),
  category: z.enum([
    "motivation",
    "experience",
    "skills",
    "values",
    "company_knowledge",
    "case",
    "career",
    "reverse_question",
    "other",
  ]),
  interviewerIntent: z.string().trim().max(300),
  answerPreparationHint: z.string().trim().max(400),
});

export const interviewExperienceDraftSchema = z.object({
  summary: z.string().trim().min(1).max(4000),
  overallImpression: z.string().trim().max(1000),
  difficulty: z.number().int().min(1).max(5).nullable(),
  questions: z.array(interviewQuestionSchema).max(50),
  insights: z.array(z.string().trim().min(1).max(400)).max(20),
  privacyWarnings: z.array(z.string().trim().min(1).max(300)).max(20),
});

export const generateInterviewExperienceRequestSchema = z.object({
  sessionId: z.string().uuid(),
  jobtrackCatalogRef: jobtrackCatalogRefSchema.optional(),
  selectionStage: selectionStageSchema.default("other"),
  interviewMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  roleCategory: z.string().trim().max(120).default(""),
});

export const saveInterviewExperienceRequestSchema = z.object({
  sessionId: z.string().uuid(),
  companySlotId: z.string().uuid().nullable().optional(),
  jobtrackCatalogRef: jobtrackCatalogRefSchema.nullable().optional(),
  companyNameSnapshot: z.string().trim().max(240).default(""),
  interviewMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .nullable()
    .optional(),
  selectionStage: selectionStageSchema,
  employmentType: employmentTypeSchema,
  interviewFormat: interviewFormatSchema,
  roleCategory: z.string().trim().max(120).default(""),
  draft: interviewExperienceDraftSchema,
  sourceMessageCount: z.number().int().min(0).max(10_000),
  sourceTranscriptSha256: z.string().regex(/^[0-9a-f]{64}$/),
  researchConsent: z.boolean(),
  consentVersion: z.string().trim().max(80).nullable().optional(),
  confirmed: z.literal(true),
});

export type InterviewExperienceDraft = z.infer<
  typeof interviewExperienceDraftSchema
>;
