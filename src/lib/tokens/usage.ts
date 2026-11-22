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

// Mercury（拡散型LLM）は、置き換える前の OpenAI モデルと同じ料金表で精算する。
// Mercury の行が無いと汎用の "*"（Sol 相当）になり、利用者の負担が増えるため。
// 対応する行が無い機能は従来どおり "*" に落ちる。
const mercuryRateFamilyByFeature: Partial<Record<AiFeature, string>> = {
  "generate-answer": "gpt-5.6-luna",
  "group-discussion": "gpt-5.6-terra",
  "summarize-interview-experience": "gpt-5.6-terra",
  "learn-interview-context": "gpt-5.6-sol",
};

function isMercuryModel(normalized: string): boolean {
  return /(?:^|\/)mercury(?:-|$)/.test(normalized);
}

function rateFamilyFor(model: string, feature?: AiFeature): string | undefined {
  const normalized = model.trim().toLowerCase();
  if (isMercuryModel(normalized)) {
    return feature ? mercuryRateFamilyByFeature[feature] : undefined;
  }
  return modelSpecificFallbackRates.find(
    ({ model: candidate }) =>
      normalized === candidate || normalized.startsWith(`${candidate}-`),
  )?.model;
}

export function fallbackRateCardForModel(
  model: string,
  feature?: AiFeature,
): TokenRateCard {
  const family = rateFamilyFor(model, feature);
  const rate = modelSpecificFallbackRates.find(
    ({ model: candidate }) => candidate === family,
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

export function rateCardModelCandidates(
  model: string,
  feature?: AiFeature,
): string[] {
  const family = rateFamilyFor(model, feature);

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
  // Responses API は input_tokens / output_tokens、Chat Completions
  // （Mercury など OpenAI 互換 API）は prompt_tokens / completion_tokens を返す。
  const inputDetails = toRecord(
    record.input_tokens_details ?? record.prompt_tokens_details,
  );
  const outputDetails = toRecord(
    record.output_tokens_details ?? record.completion_tokens_details,
  );

  return {
    inputTokens: toNumber(record.input_tokens ?? record.prompt_tokens),
    cachedInputTokens: toNumber(inputDetails.cached_tokens),
    outputTokens: toNumber(record.output_tokens ?? record.completion_tokens),
    reasoningTokens: toNumber(outputDetails.reasoning_tokens),
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
