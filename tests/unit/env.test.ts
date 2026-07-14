import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getServerEnv,
  resolveCompanyIntelligenceResearchModel,
} from "@/lib/openai/env";

const originalEnv = process.env;

describe("server env", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_ANSWER_MODEL;
    delete process.env.OPENAI_RESEARCH_MODEL;
    delete process.env.OPENAI_QUESTION_SOLVER_MODEL;
    delete process.env.OPENAI_GROUP_DISCUSSION_MODEL;
    delete process.env.COMPANY_INTELLIGENCE_DEEP_RESEARCH_MODEL;
    delete process.env.COMPANY_INTELLIGENCE_SYNTHESIS_MODEL;
    delete process.env.OPENAI_TRANSCRIPTION_DELAY;
    delete process.env.OPENAI_AUDIO_NOISE_REDUCTION;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("defaults to OpenAI even when a Groq key exists", () => {
    process.env.GROQ_API_KEY = "test-groq-key";

    const env = getServerEnv();

    expect(env.AI_PROVIDER).toBe("openai");
    expect(env.CLASSIFIER_MODEL).toBe("gpt-5.4-nano");
    expect(env.FAST_ANSWER_MODEL).toBe("gpt-5.6-luna");
    expect(env.RESEARCH_MODEL).toBe("gpt-5.6-terra");
    expect(env.QUESTION_SOLVER_MODEL).toBe("gpt-5.6-terra");
    expect(env.GROUP_DISCUSSION_MODEL).toBe("gpt-5.6-terra");
    expect(env.OPENAI_TRANSCRIPTION_DELAY).toBe("high");
    expect(env.OPENAI_AUDIO_NOISE_REDUCTION).toBe("far_field");
    expect(env.COMPANY_INTELLIGENCE_DEEP_RESEARCH_MODEL).toBe("gpt-5.6-terra");
    expect(env.COMPANY_INTELLIGENCE_SYNTHESIS_MODEL).toBe("gpt-5.6-terra");
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

  it("avoids gated deep research models for company intelligence", () => {
    process.env.OPENAI_RESEARCH_MODEL = "gpt-5.6-terra";
    process.env.COMPANY_INTELLIGENCE_DEEP_RESEARCH_MODEL =
      "o4-mini-deep-research";

    const env = getServerEnv();

    expect(resolveCompanyIntelligenceResearchModel(env)).toBe("gpt-5.6-terra");
  });

  it("avoids mini models for company intelligence research", () => {
    process.env.OPENAI_RESEARCH_MODEL = "gpt-5.6-terra";
    process.env.COMPANY_INTELLIGENCE_DEEP_RESEARCH_MODEL = "gpt-5.4-mini";

    const env = getServerEnv();

    expect(resolveCompanyIntelligenceResearchModel(env)).toBe("gpt-5.6-terra");
  });
});
