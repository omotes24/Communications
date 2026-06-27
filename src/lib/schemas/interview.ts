import { z } from "zod";

import { getCompanyInputCopy } from "@/lib/company-input-mode";
import { groupDiscussionSessionRecordSchema } from "@/lib/schemas/groupDiscussion";

export const questionCategorySchema = z.enum([
  "introduction",
  "motivation",
  "experience",
  "achievement",
  "strength",
  "weakness",
  "failure",
  "career",
  "management",
  "technical",
  "situational",
  "case",
  "followUp",
  "other",
]);

export type QuestionCategory = z.infer<typeof questionCategorySchema>;

export const speakerSchema = z.enum(["remote", "local", "manual", "practice"]);

export const userProfileSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "表示名を入力してください"),
  nameOrAlias: z.string(),
  affiliation: z.string().default(""),
  currentRole: z.string(),
  careerSummary: z.string(),
  workHistory: z.string(),
  skills: z.string(),
  strengths: z.string(),
  weaknesses: z.string(),
  achievements: z.string(),
  metrics: z.string(),
  successStories: z.string(),
  failureStories: z.string(),
  managementExperience: z.string(),
  careerChangeReason: z.string(),
  motivationMaterials: z.string(),
  preferredTone: z.string(),
  forbiddenInformation: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export const companyProfileSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "表示名を入力してください"),
  companyName: z.string(),
  business: z.string(),
  philosophy: z.string(),
  targetRole: z.string(),
  jobDescription: z.string(),
  requiredSkills: z.string(),
  interviewFocus: z.string(),
  attraction: z.string(),
  reverseQuestions: z.string(),
  researchInput: z.string().default(""),
  researchInstruction: z.string().default(""),
  researchSummary: z.string().default(""),
  researchSources: z.array(z.string()).default([]),
  fitHypotheses: z.array(z.string()).default([]),
  interviewAngles: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CompanyProfile = z.infer<typeof companyProfileSchema>;

const companyInputCopy = getCompanyInputCopy();

export const researchCompanyRequestSchema = z.preprocess(
  (value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if (
        typeof record.companyWebsite !== "string" &&
        typeof record.companyDetails === "string"
      ) {
        return { ...record, companyWebsite: record.companyDetails };
      }
    }
    return value;
  },
  z.object({
    selfInfo: z.string().trim().min(1, "自分スロットを入力してください"),
    companyName: z.string().trim().min(1, "会社名を入力してください"),
    companyWebsite: z.string().trim().min(1, companyInputCopy.schemaMissing),
    desiredCourse: z.string().trim().min(1, "志望コースを入力してください"),
    additionalNotes: z.string().default(""),
  }),
);

export type ResearchCompanyRequest = z.infer<
  typeof researchCompanyRequestSchema
>;

export const profileFileImportRequestSchema = z.object({
  fileName: z.string().trim().min(1, "ファイル名が空です"),
  fileText: z
    .string()
    .trim()
    .min(20, "読み込める文字情報が少なすぎます")
    .max(50000, "ファイル内容が大きすぎます"),
  currentProfile: userProfileSchema.nullable().default(null),
});

export type ProfileFileImportRequest = z.infer<
  typeof profileFileImportRequestSchema
>;

export const profileFileImportOutputSchema = z.object({
  label: z.string().min(1),
  nameOrAlias: z.string().default(""),
  affiliation: z.string().default(""),
  selfText: z.string().min(1),
  forbiddenInformation: z.string().default(""),
});

export type ProfileFileImportOutput = z.infer<
  typeof profileFileImportOutputSchema
>;

export const companyResearchOutputSchema = z.object({
  label: z.string().min(1),
  companyName: z.string(),
  business: z.string(),
  philosophy: z.string(),
  targetRole: z.string(),
  jobDescription: z.string(),
  requiredSkills: z.string(),
  interviewFocus: z.string(),
  attraction: z.string(),
  reverseQuestions: z.string(),
  researchSummary: z.string(),
  researchSources: z.array(z.string()),
  fitHypotheses: z.array(z.string()),
  interviewAngles: z.array(z.string()),
});

export type CompanyResearchOutput = z.infer<typeof companyResearchOutputSchema>;

export const preInterviewLearningSchema = z.object({
  brief: z.string(),
  keyPoints: z.array(z.string()),
  caution: z.string().nullable(),
  learnedAt: z.string(),
  companyId: z.string().nullable(),
  language: z.enum(["ja", "en"]).default("ja"),
});

export type PreInterviewLearning = z.infer<typeof preInterviewLearningSchema>;

export const learnInterviewContextRequestSchema = z.object({
  profile: userProfileSchema.nullable(),
  company: companyProfileSchema.nullable(),
  selfInfo: z.string().default(""),
  desiredCourse: z.string().default(""),
  additionalNotes: z.string().default(""),
  learningLanguage: z.enum(["ja", "en"]).default("ja"),
});

export type LearnInterviewContextRequest = z.infer<
  typeof learnInterviewContextRequestSchema
>;

export const learnInterviewContextOutputSchema = z.object({
  brief: z.string(),
  keyPoints: z.array(z.string()),
  caution: z.string().nullable(),
});

export type LearnInterviewContextOutput = z.infer<
  typeof learnInterviewContextOutputSchema
>;

export const legacyResearchCompanyRequestSchema = z.object({
  websiteOrUrls: z
    .string()
    .trim()
    .min(1, "WebサイトまたはURLを入力してください"),
  instruction: z.string().trim().min(1, "志望内容・指示文を入力してください"),
  profile: userProfileSchema.nullable(),
});

export const questionClassificationSchema = z.object({
  isQuestion: z.boolean(),
  confidence: z.number().min(0).max(1),
  question: z.string(),
  category: questionCategorySchema,
  requiresPersonalExample: z.boolean(),
  reason: z.string(),
});

export type QuestionClassification = z.infer<
  typeof questionClassificationSchema
>;

export const answerDraftSchema = z.object({
  question: z.string(),
  talkingPoints: z.array(z.string()).length(3),
  answer: z.string(),
  evidenceUsed: z.array(z.string()),
  missingInformation: z.array(z.string()),
  caution: z.string().nullable(),
});

export type AnswerDraft = z.infer<typeof answerDraftSchema>;

export const answerConversationTurnSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

export type AnswerConversationTurn = z.infer<
  typeof answerConversationTurnSchema
>;

export const answerModelModeSchema = z.enum(["standard", "fermi"]);

export type AnswerModelMode = z.infer<typeof answerModelModeSchema>;

export const answerLanguageSchema = z.enum(["ja", "en"]);

export type AnswerLanguage = z.infer<typeof answerLanguageSchema>;

export const classifyQuestionRequestSchema = z.object({
  transcript: z.string().trim().min(1, "文字起こしが空です"),
  speaker: speakerSchema,
  source: z.enum(["remote-audio", "local-mic", "manual", "practice"]),
});

export type ClassifyQuestionRequest = z.infer<
  typeof classifyQuestionRequestSchema
>;

export const generateAnswerRequestSchema = z.object({
  question: z.string().trim().min(1, "質問が空です"),
  category: questionCategorySchema.default("other"),
  profile: userProfileSchema.nullable(),
  company: companyProfileSchema.nullable(),
  profiles: z.array(userProfileSchema).max(8).optional(),
  companies: z.array(companyProfileSchema).max(8).optional(),
  learningBrief: z.string().default(""),
  conversationContext: z.array(answerConversationTurnSchema).max(8).default([]),
  answerModelMode: answerModelModeSchema.optional(),
  answerLanguage: answerLanguageSchema.default("ja"),
  fermiEstimationMode: z.boolean().optional(),
  selfSlot: z.string().trim().max(2000).optional(),
  answerLengthTarget: z.number().int().min(300).max(900).optional(),
});

export type GenerateAnswerRequest = z.infer<typeof generateAnswerRequestSchema>;

export const sessionRecordSchema = z.object({
  id: z.string(),
  mode: z.enum(["practice", "support"]),
  question: z.string(),
  answer: z.string(),
  talkingPoints: z.array(z.string()),
  evidenceUsed: z.array(z.string()),
  createdAt: z.string(),
});

export type SessionRecord = z.infer<typeof sessionRecordSchema>;

export const appStorageSchema = z.object({
  profiles: z.array(userProfileSchema),
  companies: z.array(companyProfileSchema),
  activeProfileId: z.string().nullable().default(null),
  activeCompanyId: z.string().nullable().default(null),
  selectedProfileIds: z.array(z.string()).default([]),
  selectedCompanyIds: z.array(z.string()).default([]),
  history: z.array(sessionRecordSchema),
  groupDiscussionSessions: z
    .array(groupDiscussionSessionRecordSchema)
    .default([]),
  learning: preInterviewLearningSchema.nullable().default(null),
  privacy: z.object({
    saveHistoryByDefault: z.boolean(),
  }),
});

export type AppStorage = z.infer<typeof appStorageSchema>;

export function createEmptyUserProfile(): UserProfile {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    label: "メインプロフィール",
    nameOrAlias: "",
    affiliation: "",
    currentRole: "",
    careerSummary: "",
    workHistory: "",
    skills: "",
    strengths: "",
    weaknesses: "",
    achievements: "",
    metrics: "",
    successStories: "",
    failureStories: "",
    managementExperience: "",
    careerChangeReason: "",
    motivationMaterials: "",
    preferredTone: "簡潔で自然な話し言葉",
    forbiddenInformation: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function createEmptyCompanyProfile(): CompanyProfile {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    label: "応募先",
    companyName: "",
    business: "",
    philosophy: "",
    targetRole: "",
    jobDescription: "",
    requiredSkills: "",
    interviewFocus: "",
    attraction: "",
    reverseQuestions: "",
    researchInput: "",
    researchInstruction: "",
    researchSummary: "",
    researchSources: [],
    fitHypotheses: [],
    interviewAngles: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function countJapaneseCharacters(value: string): number {
  return Array.from(value.replace(/\*\*/g, "").replace(/\s/g, "")).length;
}

export function validateAnswerLength(
  answer: string,
  target?: number,
): {
  count: number;
  inRange: boolean;
} {
  const count = countJapaneseCharacters(answer);
  if (target) {
    const tolerance = Math.max(60, Math.round(target * 0.18));
    return {
      count,
      inRange: count >= target - tolerance && count <= target + tolerance,
    };
  }
  return { count, inRange: count >= 250 && count <= 350 };
}
