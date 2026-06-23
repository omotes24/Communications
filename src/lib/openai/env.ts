import { z } from "zod";

const booleanEnvSchema = z
  .enum(["true", "false", "1", "0"])
  .default("false")
  .transform((value) => value === "true" || value === "1");

const serverEnvSchema = z.object({
  AI_PROVIDER: z.enum(["openai", "groq"]).default("openai"),
  AI_MOCK_MODE: booleanEnvSchema,
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  OPENAI_TRANSCRIPTION_MODEL: z.string().default("gpt-realtime-whisper"),
  OPENAI_CLASSIFIER_MODEL: z.string().default("gpt-5.4-nano"),
  OPENAI_ANSWER_MODEL: z.string().default("gpt-5.4-mini"),
  OPENAI_RESEARCH_MODEL: z.string().default("gpt-5.5"),
  OPENAI_MOCK_MODE: booleanEnvSchema,
  GROQ_API_KEY: z.string().trim().min(1).optional(),
  GROQ_TRANSCRIPTION_MODEL: z.string().default("whisper-large-v3-turbo"),
  GROQ_STRUCTURED_MODEL: z.string().default("openai/gpt-oss-20b"),
  GROQ_ANSWER_MODEL: z.string().default("openai/gpt-oss-120b"),
  GROQ_RESEARCH_MODEL: z.string().default("groq/compound"),
});

type RawServerEnv = z.infer<typeof serverEnvSchema>;

export type ServerEnv = RawServerEnv & {
  TRANSCRIPTION_MODEL: string;
  CLASSIFIER_MODEL: string;
  ANSWER_MODEL: string;
  RESEARCH_MODEL: string;
};

export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.parse({
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_MOCK_MODE: process.env.AI_MOCK_MODE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_TRANSCRIPTION_MODEL: process.env.OPENAI_TRANSCRIPTION_MODEL,
    OPENAI_CLASSIFIER_MODEL: process.env.OPENAI_CLASSIFIER_MODEL,
    OPENAI_ANSWER_MODEL: process.env.OPENAI_ANSWER_MODEL,
    OPENAI_RESEARCH_MODEL: process.env.OPENAI_RESEARCH_MODEL,
    OPENAI_MOCK_MODE: process.env.OPENAI_MOCK_MODE,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_TRANSCRIPTION_MODEL: process.env.GROQ_TRANSCRIPTION_MODEL,
    GROQ_STRUCTURED_MODEL: process.env.GROQ_STRUCTURED_MODEL,
    GROQ_ANSWER_MODEL: process.env.GROQ_ANSWER_MODEL,
    GROQ_RESEARCH_MODEL: process.env.GROQ_RESEARCH_MODEL,
  });
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
    ANSWER_MODEL:
      parsed.AI_PROVIDER === "groq"
        ? parsed.GROQ_ANSWER_MODEL
        : parsed.OPENAI_ANSWER_MODEL,
    RESEARCH_MODEL:
      parsed.AI_PROVIDER === "groq"
        ? parsed.GROQ_RESEARCH_MODEL
        : parsed.OPENAI_RESEARCH_MODEL,
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
