export type AiFeature =
  | "classify-question"
  | "generate-answer"
  | "research-company"
  | "learn-interview-context"
  | "transcribe-audio"
  | "import-profile-file"
  | "realtime-session"
  | "group-discussion"
  | "solve-question"
  | "summarize-interview-experience";

export type TokenRateCard = {
  version: string;
  inputTokenMultiplier: number;
  cachedInputTokenMultiplier: number;
  outputTokenMultiplier: number;
  reasoningTokenMultiplier: number;
  audioSecondMultiplier: number;
  webSearchMultiplier: number;
};

export type UsageParts = {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  audioSeconds?: number;
  webSearchCalls?: number;
};

export const fallbackRateCard: TokenRateCard = {
  version: "margin-v3",
  inputTokenMultiplier: 0.6,
  cachedInputTokenMultiplier: 0.06,
  outputTokenMultiplier: 3.6,
  reasoningTokenMultiplier: 3.6,
  audioSecondMultiplier: 34,
  webSearchMultiplier: 1200,
};

const modelSpecificFallbackRates: Array<{
  model: string;
  inputTokenMultiplier: number;
  cachedInputTokenMultiplier: number;
  outputTokenMultiplier: number;
}> = [
  {
    model: "gpt-5.6-luna",
    inputTokenMultiplier: 0.12,
    cachedInputTokenMultiplier: 0.012,
    outputTokenMultiplier: 0.72,
  },
  {
    model: "gpt-5.6-terra",
    inputTokenMultiplier: 0.3,
    cachedInputTokenMultiplier: 0.03,
    outputTokenMultiplier: 1.8,
  },
  {
    model: "gpt-5.6-sol",
    inputTokenMultiplier: 0.6,
    cachedInputTokenMultiplier: 0.06,
    outputTokenMultiplier: 3.6,
  },
  {
    model: "gpt-5.4-nano",
    inputTokenMultiplier: 0.024,
    cachedInputTokenMultiplier: 0.0024,
    outputTokenMultiplier: 0.15,
  },
];

export function fallbackRateCardForModel(model: string): TokenRateCard {
  const normalized = model.trim().toLowerCase();
  const rate = modelSpecificFallbackRates.find(
    ({ model: candidate }) =>
      normalized === candidate || normalized.startsWith(`${candidate}-`),
  );
  if (!rate) {
    return fallbackRateCard;
  }

  return {
    ...fallbackRateCard,
    inputTokenMultiplier: rate.inputTokenMultiplier,
    cachedInputTokenMultiplier: rate.cachedInputTokenMultiplier,
    outputTokenMultiplier: rate.outputTokenMultiplier,
    reasoningTokenMultiplier: rate.outputTokenMultiplier,
  };
}

export function rateCardModelCandidates(model: string): string[] {
  const normalized = model.trim().toLowerCase();
  const family = modelSpecificFallbackRates.find(
    ({ model: candidate }) =>
      normalized === candidate || normalized.startsWith(`${candidate}-`),
  )?.model;

  return Array.from(new Set([model, family, "*"]).values()).filter(
    (candidate): candidate is string => Boolean(candidate),
  );
}

export function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(Array.from(text).length / 3));
}

export function calculateAppTokens(
  usage: UsageParts,
  rateCard: TokenRateCard = fallbackRateCard,
): number {
  const inputTokens = usage.inputTokens ?? 0;
  const cachedInputTokens = usage.cachedInputTokens ?? 0;
  const billableInputTokens = Math.max(inputTokens - cachedInputTokens, 0);
  // OpenAI の output_tokens は reasoning_tokens を内包する。表示出力と
  // reasoning を分離し、同じトークンを二重課金しない。
  const reasoningTokens = usage.reasoningTokens ?? 0;
  const visibleOutputTokens = Math.max(
    (usage.outputTokens ?? 0) - reasoningTokens,
    0,
  );
  const total =
    billableInputTokens * rateCard.inputTokenMultiplier +
    cachedInputTokens * rateCard.cachedInputTokenMultiplier +
    visibleOutputTokens * rateCard.outputTokenMultiplier +
    reasoningTokens * rateCard.reasoningTokenMultiplier +
    (usage.audioSeconds ?? 0) * rateCard.audioSecondMultiplier +
    (usage.webSearchCalls ?? 0) * rateCard.webSearchMultiplier;

  return Math.max(1, Math.ceil(total));
}

export function extractOpenAIUsage(value: unknown): UsageParts {
  if (!value || typeof value !== "object") {
    return {};
  }

  const usage = "usage" in value ? value.usage : null;
  if (!usage || typeof usage !== "object") {
    return {};
  }

  const record = usage as Record<string, unknown>;
  const inputDetails =
    typeof record.input_tokens_details === "object" &&
    record.input_tokens_details !== null
      ? (record.input_tokens_details as Record<string, unknown>)
      : {};
  const outputDetails =
    typeof record.output_tokens_details === "object" &&
    record.output_tokens_details !== null
      ? (record.output_tokens_details as Record<string, unknown>)
      : {};

  return {
    inputTokens: toNumber(record.input_tokens),
    cachedInputTokens: toNumber(inputDetails.cached_tokens),
    outputTokens: toNumber(record.output_tokens),
    reasoningTokens: toNumber(outputDetails.reasoning_tokens),
  };
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
