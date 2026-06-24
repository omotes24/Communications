export type AiFeature =
  | "classify-question"
  | "generate-answer"
  | "research-company"
  | "learn-interview-context"
  | "transcribe-audio"
  | "import-profile-file"
  | "realtime-session";

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
  version: "default-v1",
  inputTokenMultiplier: 1,
  cachedInputTokenMultiplier: 0.25,
  outputTokenMultiplier: 4,
  reasoningTokenMultiplier: 4,
  audioSecondMultiplier: 20,
  webSearchMultiplier: 250,
};

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
  const total =
    billableInputTokens * rateCard.inputTokenMultiplier +
    cachedInputTokens * rateCard.cachedInputTokenMultiplier +
    (usage.outputTokens ?? 0) * rateCard.outputTokenMultiplier +
    (usage.reasoningTokens ?? 0) * rateCard.reasoningTokenMultiplier +
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
