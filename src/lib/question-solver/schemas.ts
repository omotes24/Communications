import { z } from "zod";

export const questionSubjectSchema = z.enum([
  "japanese",
  "math",
  "english",
  "science",
  "social",
  "unknown",
]);
export type QuestionSubject = z.infer<typeof questionSubjectSchema>;

export const questionGradeLevelSchema = z.enum([
  "junior3",
  "high1",
  "high2",
  "unknown",
]);
export type QuestionGradeLevel = z.infer<typeof questionGradeLevelSchema>;

export const questionAnswerTypeSchema = z.enum([
  "single_choice",
  "multiple_choice",
  "text_input",
  "numeric_input",
  "essay",
  "calculation",
  "proof",
  "reading_comprehension",
  "unknown",
]);
export type QuestionAnswerType = z.infer<typeof questionAnswerTypeSchema>;

export const questionSolveModeSchema = z.enum([
  "answer_only",
  "hint",
  "explanation",
  "step_by_step",
]);
export type QuestionSolveMode = z.infer<typeof questionSolveModeSchema>;

export const questionChoiceSchema = z.object({
  id: z.string().trim().min(1).max(20),
  text: z.string().trim().min(1).max(1000),
});
export type QuestionChoice = z.infer<typeof questionChoiceSchema>;

export const detectedQuestionSchema = z.object({
  questionId: z.string().trim().min(1).max(160),
  source: z.enum(["structured_dom", "json_script", "generic_dom"]),
  subject: questionSubjectSchema,
  gradeLevel: questionGradeLevelSchema,
  answerType: questionAnswerTypeSchema,
  stem: z.string().trim().min(1).max(12000),
  passage: z.string().trim().max(30000).optional(),
  visualContext: z.string().trim().max(12000).optional(),
  visualImageDataUrl: z
    .string()
    .trim()
    .regex(/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/)
    .max(2_500_000)
    .optional(),
  choices: z.array(questionChoiceSchema).max(12).optional(),
  inputSelector: z.string().trim().max(500).optional(),
  mathLatex: z.array(z.string().trim().min(1).max(2000)).max(20).optional(),
  rawText: z.string().trim().min(1).max(42000),
  pageUrl: z.string().trim().max(2048),
  pageTitle: z.string().trim().max(300),
  confidence: z.number().min(0).max(1),
});
export type DetectedQuestion = z.infer<typeof detectedQuestionSchema>;

export const solveQuestionRequestSchema = z.object({
  question: detectedQuestionSchema,
  mode: questionSolveModeSchema.default("explanation"),
  language: z.enum(["ja"]).default("ja"),
});
export type SolveQuestionRequest = z.infer<typeof solveQuestionRequestSchema>;

export const solvedQuestionStepSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(2000),
});

export const solvedQuestionSchema = z.object({
  questionId: z.string().trim().min(1),
  detectedSubject: questionSubjectSchema,
  answerType: questionAnswerTypeSchema,
  finalAnswer: z.string().trim().min(1).max(6000),
  selectedChoiceIds: z.array(z.string().trim().min(1).max(20)).nullable(),
  explanation: z.string().trim().min(1).max(12000),
  steps: z.array(solvedQuestionStepSchema).max(12),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
  warnings: z.array(z.string().trim().min(1).max(500)),
  learningPoints: z.array(z.string().trim().min(1).max(500)),
});
export type SolvedQuestion = z.infer<typeof solvedQuestionSchema>;

export const visualExtractionCellSchema = z.object({
  row: z.string().trim().max(120),
  column: z.string().trim().max(120),
  value: z.string().trim().max(300),
});
export type VisualExtractionCell = z.infer<typeof visualExtractionCellSchema>;

export const visualExtractionSchema = z.object({
  extractedText: z.string().trim().max(12000),
  tableMarkdown: z.string().trim().max(12000).nullable(),
  graphDescription: z.string().trim().max(12000).nullable(),
  cells: z.array(visualExtractionCellSchema).max(160),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string().trim().min(1).max(500)).max(10),
});
export type VisualExtraction = z.infer<typeof visualExtractionSchema>;
