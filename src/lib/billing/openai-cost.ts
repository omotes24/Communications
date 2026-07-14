export type OpenAiUsageForCost = {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  audioSeconds: number;
  webSearchCalls: number;
};

type TextPricing = {
  inputPerMillionUsd: number;
  cachedInputPerMillionUsd: number;
  outputPerMillionUsd: number;
};

// OpenAI API standard pricing, verified 2026-07-15.
// Keep this table server-side and update it when model pricing changes.
const textPricing: Record<string, TextPricing> = {
  "gpt-5.6-sol": {
    inputPerMillionUsd: 5,
    cachedInputPerMillionUsd: 0.5,
    outputPerMillionUsd: 30,
  },
  "gpt-5.6-terra": {
    inputPerMillionUsd: 2.5,
    cachedInputPerMillionUsd: 0.25,
    outputPerMillionUsd: 15,
  },
  "gpt-5.6-luna": {
    inputPerMillionUsd: 1,
    cachedInputPerMillionUsd: 0.1,
    outputPerMillionUsd: 6,
  },
  "gpt-5.5": {
    inputPerMillionUsd: 5,
    cachedInputPerMillionUsd: 0.5,
    outputPerMillionUsd: 30,
  },
  "gpt-5.4": {
    inputPerMillionUsd: 2.5,
    cachedInputPerMillionUsd: 0.25,
    outputPerMillionUsd: 15,
  },
  "gpt-5.4-mini": {
    inputPerMillionUsd: 0.75,
    cachedInputPerMillionUsd: 0.075,
    outputPerMillionUsd: 4.5,
  },
  "gpt-5.4-nano": {
    inputPerMillionUsd: 0.2,
    cachedInputPerMillionUsd: 0.02,
    outputPerMillionUsd: 1.25,
  },
};

const audioPricingPerMinuteUsd: Record<string, number> = {
  "gpt-realtime-whisper": 0.017,
};

const defaultWebSearchUsdPerCall = 0.01;

function normalizeModel(model: string): string {
  const normalized = model.trim().toLowerCase();
  // gpt-5.4 より gpt-5.4-mini / nano を先に照合する。
  const exact = Object.keys(textPricing)
    .sort((a, b) => b.length - a.length)
    .find(
      (candidate) =>
        normalized === candidate || normalized.startsWith(`${candidate}-`),
    );
  if (exact) {
    return exact;
  }
  if (normalized.includes("gpt-realtime-whisper")) {
    return "gpt-realtime-whisper";
  }
  return normalized;
}

export function estimateOpenAiCostUsd(
  usage: OpenAiUsageForCost,
  webSearchUsdPerCall = defaultWebSearchUsdPerCall,
): { costUsd: number; priced: boolean } {
  const model = normalizeModel(usage.model);
  const text = textPricing[model];
  const audioPerMinute = audioPricingPerMinuteUsd[model];
  const cachedInputTokens = Math.min(
    Math.max(usage.cachedInputTokens, 0),
    Math.max(usage.inputTokens, 0),
  );
  const uncachedInputTokens = Math.max(
    usage.inputTokens - cachedInputTokens,
    0,
  );

  let costUsd = Math.max(usage.webSearchCalls, 0) * webSearchUsdPerCall;
  let priced = usage.webSearchCalls > 0;

  if (text) {
    costUsd +=
      (uncachedInputTokens / 1_000_000) * text.inputPerMillionUsd +
      (cachedInputTokens / 1_000_000) * text.cachedInputPerMillionUsd +
      (Math.max(usage.outputTokens, 0) / 1_000_000) * text.outputPerMillionUsd;
    priced = true;
  }

  if (audioPerMinute != null && usage.audioSeconds > 0) {
    costUsd += (usage.audioSeconds / 60) * audioPerMinute;
    priced = true;
  }

  return { costUsd, priced };
}

export function getOpenAiPricingReference() {
  return {
    verifiedAt: "2026-07-15",
    sourceUrl: "https://developers.openai.com/api/docs/pricing",
  };
}
