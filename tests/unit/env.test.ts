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

  it("defaults to OpenAI even when a Groq key exists", () => {
    process.env.GROQ_API_KEY = "test-groq-key";

    const env = getServerEnv();

    expect(env.AI_PROVIDER).toBe("openai");
    expect(env.CLASSIFIER_MODEL).toBe("gpt-5.4-nano");
    expect(env.OPENAI_TRANSCRIPTION_DELAY).toBe("high");
    expect(env.OPENAI_AUDIO_NOISE_REDUCTION).toBe("far_field");
  });

  it("reads realtime transcription tuning from environment variables", () => {
    process.env.OPENAI_TRANSCRIPTION_DELAY = "medium";
    process.env.OPENAI_AUDIO_NOISE_REDUCTION = "near_field";

    const env = getServerEnv();

    expect(env.OPENAI_TRANSCRIPTION_DELAY).toBe("medium");
    expect(env.OPENAI_AUDIO_NOISE_REDUCTION).toBe("near_field");
  });

  it("uses Groq only when explicitly selected", () => {
    process.env.AI_PROVIDER = "groq";
    process.env.GROQ_API_KEY = "test-groq-key";

    const env = getServerEnv();

    expect(env.AI_PROVIDER).toBe("groq");
    expect(env.ANSWER_MODEL).toBe("openai/gpt-oss-120b");
  });
});
