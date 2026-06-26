import "server-only";

import OpenAI from "openai";

import { assertProviderKey, getServerEnv } from "@/lib/openai/env";

type OpenAIClientOptions = {
  timeoutMs?: number;
};

export function createOpenAIClient(options: OpenAIClientOptions = {}): OpenAI {
  const env = getServerEnv();
  return new OpenAI({
    apiKey: assertProviderKey(env),
    baseURL:
      env.AI_PROVIDER === "groq" ? "https://api.groq.com/openai/v1" : undefined,
    timeout: options.timeoutMs,
  });
}
