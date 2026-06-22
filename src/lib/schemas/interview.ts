import { z } from "zod";

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

export const researchCompanyRequestSchema = z.object({
  selfInfo: z.string().trim().min(1, "自分のことを入力してください"),
  companyName: z.string().trim().min(1, "会社名を入力してください"),
  companyWebsite: z.string().trim().min(1, "企業Webサイトを入力してください"),
  desiredCourse: z.string().trim().min(1, "志望コースを入力してください"),
  additionalNotes: z.string().default(""),
});

export type ResearchCompanyRequest = z.infer<
  typeof researchCompanyRequestSchema
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
});

export type PreInterviewLearning = z.infer<typeof preInterviewLearningSchema>;

export const learnInterviewContextRequestSchema = z.object({
  profile: userProfileSchema.nullable(),
  company: companyProfileSchema.nullable(),
  selfInfo: z.string().default(""),
  desiredCourse: z.string().default(""),
  additionalNotes: z.string().default(""),
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
  learningBrief: z.string().default(""),
  conversationContext: z.array(answerConversationTurnSchema).max(8).default([]),
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
  history: z.array(sessionRecordSchema),
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
  return Array.from(value.replace(/\s/g, "")).length;
}

export function validateAnswerLength(answer: string): {
  count: number;
  inRange: boolean;
} {
  const count = countJapaneseCharacters(answer);
  return { count, inRange: count >= 250 && count <= 350 };
}
