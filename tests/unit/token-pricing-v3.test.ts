import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { estimateOpenAiCostUsd } from "@/lib/billing/openai-cost";
import {
  calculateAppTokens,
  fallbackRateCard,
  fallbackRateCardForModel,
  rateCardModelCandidates,
} from "@/lib/tokens/usage";

describe("margin-v3 token economics", () => {
  it("does not charge reasoning tokens twice", () => {
    expect(
      calculateAppTokens({
        inputTokens: 1_000,
        cachedInputTokens: 100,
        outputTokens: 200,
        reasoningTokens: 50,
      }),
    ).toBe(1_266);
  });

  it("uses the current fallback margin card", () => {
    expect(fallbackRateCard).toMatchObject({
      version: "margin-v3",
      audioSecondMultiplier: 34,
      webSearchMultiplier: 1_200,
    });
  });

  it("falls back to each configured model's rate when the database is unavailable", () => {
    expect(fallbackRateCardForModel("gpt-5.6-luna")).toMatchObject({
      inputTokenMultiplier: 0.12,
      cachedInputTokenMultiplier: 0.012,
      outputTokenMultiplier: 0.72,
    });
    expect(fallbackRateCardForModel("gpt-5.6-terra-2026-07-15")).toMatchObject({
      inputTokenMultiplier: 0.3,
      cachedInputTokenMultiplier: 0.03,
      outputTokenMultiplier: 1.8,
    });
    expect(fallbackRateCardForModel("unknown-model")).toBe(fallbackRateCard);
    expect(rateCardModelCandidates("gpt-5.6-luna-2026-07-15")).toEqual([
      "gpt-5.6-luna-2026-07-15",
      "gpt-5.6-luna",
      "*",
    ]);
  });

  it("estimates model, cached input, search, and audio costs", () => {
    const text = estimateOpenAiCostUsd({
      model: "gpt-5.4-mini-2026-06-01",
      inputTokens: 1_000_000,
      cachedInputTokens: 100_000,
      outputTokens: 200_000,
      audioSeconds: 0,
      webSearchCalls: 2,
    });
    expect(text.priced).toBe(true);
    expect(text.costUsd).toBeCloseTo(1.6025, 8);

    const audio = estimateOpenAiCostUsd({
      model: "gpt-realtime-whisper",
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      audioSeconds: 60,
      webSearchCalls: 0,
    });
    expect(audio.costUsd).toBeCloseTo(0.017, 8);
  });

  it("prices every GPT-5.6 tier", () => {
    const usage = {
      inputTokens: 1_000_000,
      cachedInputTokens: 100_000,
      outputTokens: 200_000,
      audioSeconds: 0,
      webSearchCalls: 0,
    };

    const luna = estimateOpenAiCostUsd({ model: "gpt-5.6-luna", ...usage });
    const terra = estimateOpenAiCostUsd({ model: "gpt-5.6-terra", ...usage });
    const sol = estimateOpenAiCostUsd({ model: "gpt-5.6-sol", ...usage });

    expect(luna.priced).toBe(true);
    expect(luna.costUsd).toBeCloseTo(2.11, 8);
    expect(terra.priced).toBe(true);
    expect(terra.costUsd).toBeCloseTo(5.275, 8);
    expect(sol.priced).toBe(true);
    expect(sol.costUsd).toBeCloseTo(10.55, 8);
  });

  it("ships a rate for every AI feature, including future admin summaries", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/202607140004_margin_v3_rate_card.sql",
      ),
      "utf8",
    );
    for (const feature of [
      "classify-question",
      "generate-answer",
      "research-company",
      "learn-interview-context",
      "transcribe-audio",
      "import-profile-file",
      "realtime-session",
      "group-discussion",
      "solve-question",
      "summarize-interview-experience",
    ]) {
      expect(sql).toContain(`'${feature}'`);
    }
  });

  it("ships model-specific margin rates for the active GPT-5.6 routes", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/202607150002_gpt56_margin_v3_rate_card.sql",
      ),
      "utf8",
    );

    for (const model of ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"]) {
      expect(sql).toContain(`'${model}'`);
    }
    for (const feature of [
      "generate-answer",
      "research-company",
      "learn-interview-context",
      "group-discussion",
      "solve-question",
      "summarize-interview-experience",
    ]) {
      expect(sql).toContain(`'${feature}'`);
    }
  });
});
