import OpenAI from "openai";

import { assertProviderKey, getServerEnv } from "@/lib/openai/env";

export function createOpenAIClient(): OpenAI {
  const env = getServerEnv();
  return new OpenAI({
    apiKey: assertProviderKey(env),
    baseURL:
      env.AI_PROVIDER === "groq" ? "https://api.groq.com/openai/v1" : undefined,
  });
}
