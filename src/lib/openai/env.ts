import { z } from "zod";

const serverEnvSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  OPENAI_TRANSCRIPTION_MODEL: z.string().default("gpt-realtime-whisper"),
  OPENAI_CLASSIFIER_MODEL: z.string().default("gpt-5.4-nano"),
  OPENAI_ANSWER_MODEL: z.string().default("gpt-5.5-mini"),
  OPENAI_RESEARCH_MODEL: z.string().default("gpt-5.5"),
  OPENAI_MOCK_MODE: z
    .enum(["true", "false", "1", "0"])
    .default("false")
    .transform((value) => value === "true" || value === "1"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_TRANSCRIPTION_MODEL: process.env.OPENAI_TRANSCRIPTION_MODEL,
    OPENAI_CLASSIFIER_MODEL: process.env.OPENAI_CLASSIFIER_MODEL,
    OPENAI_ANSWER_MODEL: process.env.OPENAI_ANSWER_MODEL,
    OPENAI_RESEARCH_MODEL: process.env.OPENAI_RESEARCH_MODEL,
    OPENAI_MOCK_MODE: process.env.OPENAI_MOCK_MODE,
  });
}

export function assertOpenAIKey(env: ServerEnv): string {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY が設定されていません");
  }
  return env.OPENAI_API_KEY;
}
