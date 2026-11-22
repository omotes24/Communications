import "server-only";

import { z } from "zod";
import { DEFAULT_MERCURY_DISABLE_AFTER } from "@/lib/ai/text-provider";
import { realtimeTranscriptionDelays } from "@/lib/openai/transcription-delay";

const booleanEnvSchema = z
  .enum(["true", "false", "1", "0"])
  .default("false")
  .transform((value) => value === "true" || value === "1");

const enabledBooleanEnvSchema = z
  .enum(["true", "false", "1", "0"])
  .default("true")
  .transform((value) => value === "true" || value === "1");

const defaultCompanyIntelligenceResearchModel = "gpt-5.6-terra";
const miniModelPattern = /(?:^|[-_.])mini(?:$|[-_.])/;

// Inception の API は instant / low / medium / high、Vercel AI Gateway は
// none / minimal / low / medium / high を受け付ける。どちらで書いても、
// src/lib/ai/mercury.ts が接続先に合わせて読み替える。
const mercuryReasoningEffortSchema = z.enum([
  "none",
  "minimal",
  "instant",
  "low",
  "medium",
  "high",
]);

// Inception の Mercury API は 2026-12-28 で終了する。この日時を過ぎたら
// AI_TEXT_PROVIDER=mercury でも自動で AI_PROVIDER に戻す。
const defaultMercuryDisableAfter = DEFAULT_MERCURY_DISABLE_AFTER;

export type MercuryReasoningEffort = z.infer<
  typeof mercuryReasoningEffortSchema
>;

const serverEnvSchema = z.object({
  // 文字起こし・リアルタイム音声・Web検索付き企業調査のプロバイダ。
  AI_PROVIDER: z.enum(["openai", "groq"]).default("openai"),
  // テキスト生成（回答・分類・GD・学習メモなど）のプロバイダ。未設定なら AI_PROVIDER と同じ。
  AI_TEXT_PROVIDER: z.enum(["openai", "groq", "mercury"]).optional(),
  AI_MOCK_MODE: booleanEnvSchema,
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  OPENAI_BASE_URL: z.string().trim().url().optional(),
  OPENAI_TRANSCRIPTION_MODEL: z.string().default("gpt-realtime-whisper"),
  OPENAI_TRANSCRIPTION_DELAY: z
    .enum(realtimeTranscriptionDelays)
    .default("high"),
  OPENAI_AUDIO_NOISE_REDUCTION: z
    .enum(["near_field", "far_field", "off"])
    .default("far_field"),
  OPENAI_CLASSIFIER_MODEL: z.string().default("gpt-5.4-nano"),
  OPENAI_ANSWER_MODEL: z.string().default("gpt-5.6-luna"),
  OPENAI_RESEARCH_MODEL: z.string().default("gpt-5.6-terra"),
  OPENAI_COMPANY_RESEARCH_MODEL: z.string().default("gpt-5.6-sol"),
  OPENAI_INTERVIEW_LEARNING_MODEL: z.string().default("gpt-5.6-sol"),
  OPENAI_QUESTION_SOLVER_MODEL: z.string().default("gpt-5.6-terra"),
  OPENAI_GROUP_DISCUSSION_MODEL: z.string().default("gpt-5.6-terra"),
  OPENAI_GD_MOCK_MODE: booleanEnvSchema,
  COMPANY_INTELLIGENCE_STRICT_MODE: enabledBooleanEnvSchema,
  COMPANY_INTELLIGENCE_MOCK_MODE: booleanEnvSchema,
  COMPANY_INTELLIGENCE_DEEP_RESEARCH_MODEL: z
    .string()
    .default(defaultCompanyIntelligenceResearchModel),
  COMPANY_INTELLIGENCE_SYNTHESIS_MODEL: z.string().default("gpt-5.6-terra"),
  OPENAI_MOCK_MODE: booleanEnvSchema,
  GROQ_API_KEY: z.string().trim().min(1).optional(),
  GROQ_TRANSCRIPTION_MODEL: z.string().default("whisper-large-v3-turbo"),
  GROQ_STRUCTURED_MODEL: z.string().default("openai/gpt-oss-20b"),
  GROQ_FAST_ANSWER_MODEL: z.string().default("openai/gpt-oss-20b"),
  GROQ_ANSWER_MODEL: z.string().default("openai/gpt-oss-120b"),
  GROQ_RESEARCH_MODEL: z.string().default("groq/compound"),
  MERCURY_API_KEY: z.string().trim().min(1).optional(),
  // Inception の API は新規登録を締め切ったため、既定は Vercel AI Gateway 経由。
  MERCURY_BASE_URL: z
    .string()
    .trim()
    .url()
    .default("https://ai-gateway.vercel.sh/v1"),
  MERCURY_FAST_MODEL: z.string().default("inception/mercury-3"),
  MERCURY_MODEL: z.string().default("inception/mercury-3"),
  MERCURY_FAST_REASONING_EFFORT: mercuryReasoningEffortSchema.default("none"),
  MERCURY_REASONING_EFFORT: mercuryReasoningEffortSchema.default("medium"),
  // 面接中のフェルミ推定。medium だと実測で約21秒かかるため、既定は low。
  MERCURY_FERMI_REASONING_EFFORT: mercuryReasoningEffortSchema.default("low"),
  // 面接前メモの学習。実測（入力約5,500トークン）で low は約3秒、medium は 4〜10秒で
  // 推論が膨らむことがある。内容に差がないので既定は low。
  MERCURY_LEARNING_REASONING_EFFORT:
    mercuryReasoningEffortSchema.default("low"),
  MERCURY_DISABLE_AFTER: z.string().trim().default(defaultMercuryDisableAfter),
});

type RawServerEnv = z.infer<typeof serverEnvSchema>;

export type TextProvider = "openai" | "groq" | "mercury";

export type ServerEnv = RawServerEnv & {
  TEXT_PROVIDER: TextProvider;
  TRANSCRIPTION_MODEL: string;
  CLASSIFIER_MODEL: string;
  FAST_ANSWER_MODEL: string;
  ANSWER_MODEL: string;
  RESEARCH_MODEL: string;
  COMPANY_RESEARCH_MODEL: string;
  INTERVIEW_LEARNING_MODEL: string;
  QUESTION_SOLVER_MODEL: string;
  GROUP_DISCUSSION_MODEL: string;
};

export function getServerEnv(): ServerEnv {
  const rawProvider = process.env.AI_PROVIDER || "openai";
  const parsed = serverEnvSchema.parse({
    AI_PROVIDER: rawProvider,
    AI_MOCK_MODE: process.env.AI_MOCK_MODE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_TRANSCRIPTION_MODEL: process.env.OPENAI_TRANSCRIPTION_MODEL,
    OPENAI_TRANSCRIPTION_DELAY: process.env.OPENAI_TRANSCRIPTION_DELAY,
    OPENAI_AUDIO_NOISE_REDUCTION: process.env.OPENAI_AUDIO_NOISE_REDUCTION,
    OPENAI_CLASSIFIER_MODEL: process.env.OPENAI_CLASSIFIER_MODEL,
    OPENAI_ANSWER_MODEL: process.env.OPENAI_ANSWER_MODEL,
    OPENAI_RESEARCH_MODEL: process.env.OPENAI_RESEARCH_MODEL,
    OPENAI_COMPANY_RESEARCH_MODEL: process.env.OPENAI_COMPANY_RESEARCH_MODEL,
    OPENAI_INTERVIEW_LEARNING_MODEL:
      process.env.OPENAI_INTERVIEW_LEARNING_MODEL,
    OPENAI_QUESTION_SOLVER_MODEL: process.env.OPENAI_QUESTION_SOLVER_MODEL,
    OPENAI_GROUP_DISCUSSION_MODEL: process.env.OPENAI_GROUP_DISCUSSION_MODEL,
    OPENAI_GD_MOCK_MODE: process.env.OPENAI_GD_MOCK_MODE,
    COMPANY_INTELLIGENCE_STRICT_MODE:
      process.env.COMPANY_INTELLIGENCE_STRICT_MODE,
    COMPANY_INTELLIGENCE_MOCK_MODE: process.env.COMPANY_INTELLIGENCE_MOCK_MODE,
    COMPANY_INTELLIGENCE_DEEP_RESEARCH_MODEL:
      process.env.COMPANY_INTELLIGENCE_DEEP_RESEARCH_MODEL,
    COMPANY_INTELLIGENCE_SYNTHESIS_MODEL:
      process.env.COMPANY_INTELLIGENCE_SYNTHESIS_MODEL,
    OPENAI_MOCK_MODE: process.env.OPENAI_MOCK_MODE,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_TRANSCRIPTION_MODEL: process.env.GROQ_TRANSCRIPTION_MODEL,
    GROQ_STRUCTURED_MODEL: process.env.GROQ_STRUCTURED_MODEL,
    GROQ_FAST_ANSWER_MODEL: process.env.GROQ_FAST_ANSWER_MODEL,
    GROQ_ANSWER_MODEL: process.env.GROQ_ANSWER_MODEL,
    GROQ_RESEARCH_MODEL: process.env.GROQ_RESEARCH_MODEL,
    AI_TEXT_PROVIDER: process.env.AI_TEXT_PROVIDER || undefined,
    MERCURY_API_KEY: process.env.MERCURY_API_KEY,
    MERCURY_BASE_URL: process.env.MERCURY_BASE_URL || undefined,
    MERCURY_FAST_MODEL: process.env.MERCURY_FAST_MODEL || undefined,
    MERCURY_MODEL: process.env.MERCURY_MODEL || undefined,
    MERCURY_FAST_REASONING_EFFORT:
      process.env.MERCURY_FAST_REASONING_EFFORT || undefined,
    MERCURY_REASONING_EFFORT: process.env.MERCURY_REASONING_EFFORT || undefined,
    MERCURY_FERMI_REASONING_EFFORT:
      process.env.MERCURY_FERMI_REASONING_EFFORT || undefined,
    MERCURY_LEARNING_REASONING_EFFORT:
      process.env.MERCURY_LEARNING_REASONING_EFFORT || undefined,
    MERCURY_DISABLE_AFTER: process.env.MERCURY_DISABLE_AFTER || undefined,
  });
  const textProvider = resolveTextProvider(parsed);
  const resolved = resolveProviderModels(parsed);
  if (textProvider !== "mercury") {
    return { ...resolved, TEXT_PROVIDER: textProvider };
  }
  return {
    ...resolved,
    TEXT_PROVIDER: textProvider,
    CLASSIFIER_MODEL: parsed.MERCURY_FAST_MODEL,
    FAST_ANSWER_MODEL: parsed.MERCURY_FAST_MODEL,
    ANSWER_MODEL: parsed.MERCURY_MODEL,
    INTERVIEW_LEARNING_MODEL: parsed.MERCURY_MODEL,
    GROUP_DISCUSSION_MODEL: parsed.MERCURY_MODEL,
  };
}

export function resolveTextProvider(
  parsed: Pick<
    RawServerEnv,
    "AI_PROVIDER" | "AI_TEXT_PROVIDER" | "MERCURY_DISABLE_AFTER"
  >,
  now: Date = new Date(),
): TextProvider {
  const requested = parsed.AI_TEXT_PROVIDER ?? parsed.AI_PROVIDER;
  if (requested !== "mercury") {
    return requested;
  }
  const disableAt = Date.parse(parsed.MERCURY_DISABLE_AFTER);
  if (Number.isFinite(disableAt) && now.getTime() >= disableAt) {
    return parsed.AI_PROVIDER;
  }
  return "mercury";
}

function resolveProviderModels(
  parsed: RawServerEnv,
): Omit<ServerEnv, "TEXT_PROVIDER"> {
  return {
    ...parsed,
    AI_MOCK_MODE: parsed.AI_MOCK_MODE || parsed.OPENAI_MOCK_MODE,
    TRANSCRIPTION_MODEL:
      parsed.AI_PROVIDER === "groq"
        ? parsed.GROQ_TRANSCRIPTION_MODEL
        : parsed.OPENAI_TRANSCRIPTION_MODEL,
    CLASSIFIER_MODEL:
      parsed.AI_PROVIDER === "groq"
        ? parsed.GROQ_STRUCTURED_MODEL
        : parsed.OPENAI_CLASSIFIER_MODEL,
    FAST_ANSWER_MODEL:
      parsed.AI_PROVIDER === "groq"
        ? parsed.GROQ_FAST_ANSWER_MODEL
        : parsed.OPENAI_ANSWER_MODEL,
    ANSWER_MODEL:
      parsed.AI_PROVIDER === "groq"
        ? parsed.GROQ_ANSWER_MODEL
        : parsed.OPENAI_ANSWER_MODEL,
    RESEARCH_MODEL:
      parsed.AI_PROVIDER === "groq"
        ? parsed.GROQ_RESEARCH_MODEL
        : parsed.OPENAI_RESEARCH_MODEL,
    COMPANY_RESEARCH_MODEL:
      parsed.AI_PROVIDER === "groq"
        ? parsed.GROQ_RESEARCH_MODEL
        : parsed.OPENAI_COMPANY_RESEARCH_MODEL,
    INTERVIEW_LEARNING_MODEL:
      parsed.AI_PROVIDER === "groq"
        ? parsed.GROQ_ANSWER_MODEL
        : parsed.OPENAI_INTERVIEW_LEARNING_MODEL,
    QUESTION_SOLVER_MODEL:
      parsed.AI_PROVIDER === "groq"
        ? parsed.GROQ_ANSWER_MODEL
        : parsed.OPENAI_QUESTION_SOLVER_MODEL,
    GROUP_DISCUSSION_MODEL:
      parsed.AI_PROVIDER === "groq"
        ? parsed.GROQ_ANSWER_MODEL
        : parsed.OPENAI_GROUP_DISCUSSION_MODEL,
  };
}

export function assertProviderKey(env: ServerEnv): string {
  if (env.AI_PROVIDER === "groq") {
    if (!env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY が設定されていません");
    }
    return env.GROQ_API_KEY;
  }
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY が設定されていません");
  }
  return env.OPENAI_API_KEY;
}

export function assertOpenAIKey(env: ServerEnv): string {
  return assertProviderKey(env);
}

export function assertMercuryKey(env: ServerEnv): string {
  if (!env.MERCURY_API_KEY) {
    throw new Error("MERCURY_API_KEY が設定されていません");
  }
  return env.MERCURY_API_KEY;
}

export function structuredOutputModel(env: ServerEnv): string {
  if (env.TEXT_PROVIDER === "mercury") {
    return env.ANSWER_MODEL;
  }
  return env.AI_PROVIDER === "groq" ? env.ANSWER_MODEL : env.RESEARCH_MODEL;
}

function isUnsuitableCompanyIntelligenceResearchModel(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return (
    normalized.includes("deep-research") || miniModelPattern.test(normalized)
  );
}

export function resolveCompanyIntelligenceResearchModel(
  env: ServerEnv,
): string {
  const configured = env.COMPANY_INTELLIGENCE_DEEP_RESEARCH_MODEL.trim();
  if (!configured) {
    return defaultCompanyIntelligenceResearchModel;
  }

  if (isUnsuitableCompanyIntelligenceResearchModel(configured)) {
    const fallback = env.OPENAI_RESEARCH_MODEL.trim();
    if (fallback && !isUnsuitableCompanyIntelligenceResearchModel(fallback)) {
      return fallback;
    }
    return defaultCompanyIntelligenceResearchModel;
  }

  return configured;
}
