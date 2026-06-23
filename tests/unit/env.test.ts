import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getServerEnv } from "@/lib/openai/env";

const originalEnv = process.env;

describe("server env", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses Groq when a Groq key exists and provider is omitted", () => {
    process.env.GROQ_API_KEY = "test-groq-key";

    const env = getServerEnv();

    expect(env.AI_PROVIDER).toBe("groq");
    expect(env.CLASSIFIER_MODEL).toBe("openai/gpt-oss-20b");
  });
});
