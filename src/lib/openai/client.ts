import OpenAI from "openai";

import { assertOpenAIKey, getServerEnv } from "@/lib/openai/env";

export function createOpenAIClient(): OpenAI {
  const env = getServerEnv();
  return new OpenAI({ apiKey: assertOpenAIKey(env) });
}
