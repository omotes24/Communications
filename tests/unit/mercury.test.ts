import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

import {
  buildMercuryRequestBody,
  generateMercuryStructured,
  parseMercuryJson,
  streamMercuryStructured,
  toProviderReasoningEffort,
} from "@/lib/ai/mercury";
import {
  getServerEnv,
  resolveTextProvider,
  structuredOutputModel,
} from "@/lib/openai/env";
import {
  extractOpenAIUsage,
  fallbackRateCardForModel,
  rateCardModelCandidates,
} from "@/lib/tokens/usage";

const originalEnv = process.env;

function resetEnv() {
  process.env = { ...originalEnv };
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith("AI_") ||
      key.startsWith("OPENAI_") ||
      key.startsWith("MERCURY_")
    ) {
      delete process.env[key];
    }
  }
}

function mercuryEnv() {
  resetEnv();
  process.env.AI_TEXT_PROVIDER = "mercury";
  process.env.MERCURY_API_KEY = "test-key";
  process.env.MERCURY_DISABLE_AFTER = "2999-01-01T00:00:00Z";
  return getServerEnv();
}

describe("Mercury text provider env", () => {
  beforeEach(resetEnv);
  afterEach(() => {
    process.env = originalEnv;
  });

  it("follows AI_PROVIDER when AI_TEXT_PROVIDER is unset", () => {
    const env = getServerEnv();
    expect(env.TEXT_PROVIDER).toBe("openai");
    expect(env.CLASSIFIER_MODEL).toBe("gpt-5.4-nano");
  });

  it("routes text models to Mercury 3 on Vercel AI Gateway", () => {
    const env = mercuryEnv();

    expect(env.AI_PROVIDER).toBe("openai");
    expect(env.TEXT_PROVIDER).toBe("mercury");
    expect(env.MERCURY_BASE_URL).toBe("https://ai-gateway.vercel.sh/v1");
    expect(env.CLASSIFIER_MODEL).toBe("inception/mercury-3");
    expect(env.FAST_ANSWER_MODEL).toBe("inception/mercury-3");
    expect(env.ANSWER_MODEL).toBe("inception/mercury-3");
    expect(env.GROUP_DISCUSSION_MODEL).toBe("inception/mercury-3");
    expect(env.INTERVIEW_LEARNING_MODEL).toBe("inception/mercury-3");
    expect(structuredOutputModel(env)).toBe("inception/mercury-3");
    expect(env.MERCURY_FAST_REASONING_EFFORT).toBe("none");
    expect(env.MERCURY_REASONING_EFFORT).toBe("medium");
    expect(env.MERCURY_FERMI_REASONING_EFFORT).toBe("low");
  });

  it("keeps transcription, company research and the question solver on OpenAI", () => {
    const env = mercuryEnv();

    expect(env.TRANSCRIPTION_MODEL).toBe("gpt-realtime-whisper");
    expect(env.COMPANY_RESEARCH_MODEL).toBe("gpt-5.6-sol");
    expect(env.QUESTION_SOLVER_MODEL).toBe("gpt-5.6-terra");
  });

  it("falls back to AI_PROVIDER after the Mercury shutdown date", () => {
    const settings = {
      AI_PROVIDER: "openai" as const,
      AI_TEXT_PROVIDER: "mercury" as const,
      MERCURY_DISABLE_AFTER: "2026-12-28T00:00:00+09:00",
    };

    expect(
      resolveTextProvider(settings, new Date("2026-12-27T14:59:59Z")),
    ).toBe("mercury");
    expect(
      resolveTextProvider(settings, new Date("2026-12-27T15:00:00Z")),
    ).toBe("openai");
  });
});

describe("toProviderReasoningEffort", () => {
  it("uses the gateway vocabulary on Vercel AI Gateway", () => {
    const gateway = "https://ai-gateway.vercel.sh/v1";
    expect(toProviderReasoningEffort(gateway, "instant")).toBe("none");
    expect(toProviderReasoningEffort(gateway, "none")).toBe("none");
    expect(
      toProviderReasoningEffort("https://eu.ai-gateway.vercel.sh/v1", "low"),
    ).toBe("low");
  });

  it("uses the Inception vocabulary on the Inception API", () => {
    const inception = "https://api.inceptionlabs.ai/v1";
    expect(toProviderReasoningEffort(inception, "none")).toBe("instant");
    expect(toProviderReasoningEffort(inception, "minimal")).toBe("instant");
    expect(toProviderReasoningEffort(inception, "medium")).toBe("medium");
  });
});

describe("Mercury requests", () => {
  const draftSchema = z.object({
    answer: z.string(),
    points: z.array(z.string()).length(2),
  });
  const valid = JSON.stringify({ answer: "回答", points: ["a", "b"] });
  const usage = {
    prompt_tokens: 100,
    completion_tokens: 40,
    total_tokens: 140,
    prompt_tokens_details: { cached_tokens: 10 },
    completion_tokens_details: { reasoning_tokens: 5 },
  };

  beforeEach(() => {
    create.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("writes the JSON Schema into the system prompt and uses none for fast requests", () => {
    const body = buildMercuryRequestBody({
      env: mercuryEnv(),
      model: "inception/mercury-3",
      instructions: "面接の回答案を作る",
      input: "質問",
      schema: draftSchema,
      name: "draft",
      speed: "fast",
    });

    const system = String(body.messages[0].content);
    expect(body.messages[0].role).toBe("system");
    expect(system).toContain("面接の回答案を作る");
    expect(system).toContain('"required"');
    expect(system).toContain('"points"');
    expect(body.messages[1]).toEqual({ role: "user", content: "質問" });
    expect(body.response_format.type).toBe("json_schema");
    expect(body.reasoning_effort).toBe("none");
    expect(
      buildMercuryRequestBody({
        env: mercuryEnv(),
        model: "inception/mercury-3",
        input: "質問",
        schema: draftSchema,
        name: "draft",
        speed: "standard",
        reasoningEffort: "low",
      }).reasoning_effort,
    ).toBe("low");
  });

  it("retries once when the JSON does not match the schema and adds up usage", async () => {
    create
      .mockResolvedValueOnce({
        choices: [{ message: { content: '{"回答":"x"}' } }],
        usage,
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: valid } }],
        usage,
      });

    const result = await generateMercuryStructured({
      env: mercuryEnv(),
      model: "inception/mercury-3",
      input: "質問",
      schema: draftSchema,
      name: "draft",
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(result.output_parsed).toEqual({
      answer: "回答",
      points: ["a", "b"],
    });
    expect(extractOpenAIUsage(result)).toEqual({
      inputTokens: 200,
      cachedInputTokens: 20,
      outputTokens: 80,
      reasoningTokens: 10,
    });
  });

  it("gives up after one retry", async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: "not json" } }],
      usage,
    });

    const result = await generateMercuryStructured({
      env: mercuryEnv(),
      model: "inception/mercury-3",
      input: "質問",
      schema: draftSchema,
      name: "draft",
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(result.output_parsed).toBeNull();
  });

  it("streams deltas and restarts the buffer when it retries", async () => {
    async function* chunks(parts: string[]) {
      for (const content of parts) {
        yield { choices: [{ index: 0, delta: { content } }] };
      }
      yield { choices: [], usage };
    }
    create
      .mockResolvedValueOnce(chunks(['{"answer":', '"x"}']))
      .mockResolvedValueOnce(chunks([valid.slice(0, 10), valid.slice(10)]));
    const buffers: string[] = [];

    const result = await streamMercuryStructured(
      {
        env: mercuryEnv(),
        model: "inception/mercury-3",
        input: "質問",
        schema: draftSchema,
        name: "draft",
        speed: "fast",
      },
      (buffer) => buffers.push(buffer),
    );

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0]).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
      reasoning_effort: "none",
    });
    expect(buffers).toEqual([
      '{"answer":',
      '{"answer":"x"}',
      valid.slice(0, 10),
      valid,
    ]);
    expect(result.output_parsed).toEqual({
      answer: "回答",
      points: ["a", "b"],
    });
    expect(extractOpenAIUsage(result).inputTokens).toBe(200);
  });
});

describe("parseMercuryJson", () => {
  const schema = z.object({ answer: z.string() });

  it("parses plain and fenced JSON", () => {
    expect(parseMercuryJson(schema, '{"answer":"a"}')).toEqual({ answer: "a" });
    expect(parseMercuryJson(schema, '```json\n{"answer":"b"}\n```')).toEqual({
      answer: "b",
    });
  });

  it("returns null for empty, invalid, or schema-mismatched content", () => {
    expect(parseMercuryJson(schema, null)).toBeNull();
    expect(parseMercuryJson(schema, "not json")).toBeNull();
    expect(parseMercuryJson(schema, '{"answer":1}')).toBeNull();
  });
});

describe("extractOpenAIUsage", () => {
  it("reads Chat Completions usage fields", () => {
    expect(
      extractOpenAIUsage({
        usage: {
          prompt_tokens: 100,
          completion_tokens: 40,
          prompt_tokens_details: { cached_tokens: 10 },
          completion_tokens_details: { reasoning_tokens: 5 },
        },
      }),
    ).toEqual({
      inputTokens: 100,
      cachedInputTokens: 10,
      outputTokens: 40,
      reasoningTokens: 5,
    });
  });
});

describe("Mercury billing", () => {
  it("bills Mercury with the rate card of the OpenAI model it replaces", () => {
    expect(
      rateCardModelCandidates("inception/mercury-3", "generate-answer"),
    ).toEqual(["inception/mercury-3", "gpt-5.6-luna", "*"]);
    expect(
      rateCardModelCandidates("inception/mercury-3", "group-discussion"),
    ).toEqual(["inception/mercury-3", "gpt-5.6-terra", "*"]);
    expect(
      rateCardModelCandidates("mercury-3", "learn-interview-context"),
    ).toEqual(["mercury-3", "gpt-5.6-sol", "*"]);
    expect(
      rateCardModelCandidates("inception/mercury-3", "classify-question"),
    ).toEqual(["inception/mercury-3", "*"]);
    expect(
      fallbackRateCardForModel("inception/mercury-3", "generate-answer"),
    ).toMatchObject({
      inputTokenMultiplier: 0.12,
      outputTokenMultiplier: 0.72,
    });
  });

  it("keeps OpenAI model families unchanged", () => {
    expect(
      rateCardModelCandidates("gpt-5.6-luna-2026-07-15", "generate-answer"),
    ).toEqual(["gpt-5.6-luna-2026-07-15", "gpt-5.6-luna", "*"]);
  });
});
