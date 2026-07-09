import { randomUUID } from "node:crypto";

import { getServerSupabaseConfig } from "@/lib/supabase/server-config";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  calculateAppTokens,
  fallbackRateCard,
  type AiFeature,
  type TokenRateCard,
  type UsageParts,
} from "@/lib/tokens/usage";

const insufficientBalanceMessage =
  "トークン残高が不足しています。現在の残高をご確認ください。";

type TokenReservation = {
  requestId: string;
  operationId: string;
  userId: string;
  feature: AiFeature;
  provider: string;
  model: string;
  rateCard: TokenRateCard;
  reservedAmount: number;
  expiresAt: string;
  startedAt: number;
};

type Wallet = {
  available_balance: number;
  reserved_balance: number;
  lifetime_granted: number;
  lifetime_consumed: number;
};

export type UsageEventRow = {
  created_at: string;
  feature: string;
  model: string;
  calculated_app_tokens: number;
  status: string;
  latency_ms: number | null;
};

export type LedgerEventRow = {
  created_at: string;
  event_type: string;
  amount: number;
  available_balance_after: number;
  reserved_balance_after: number;
  feature: string | null;
  model: string | null;
};

const testWallets = new Map<string, Wallet>();
const testReservations = new Map<string, TokenReservation & { status: string }>();

export function resetTestTokenState(userId: string, balance = 100000) {
  testWallets.set(userId, {
    available_balance: balance,
    reserved_balance: 0,
    lifetime_granted: balance,
    lifetime_consumed: 0,
  });
  testReservations.clear();
}

function shouldUseTestTokenStore(): boolean {
  if (process.env.TOKEN_TEST_MODE !== "true") {
    return false;
  }
  if (process.env.NODE_ENV === "test") {
    return true;
  }
  return (
    process.env.NODE_ENV === "development" &&
    process.env.E2E_TEST_AUTH === "true" &&
    process.env.AI_MOCK_MODE === "true"
  );
}

function shouldUseLocalTokenStore(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.LOCAL_TOKEN_BYPASS === "true"
  );
}

function shouldUseMemoryTokenStore(): boolean {
  return shouldUseTestTokenStore() || shouldUseLocalTokenStore();
}

function isTokenSystemConfigured(): boolean {
  return Boolean(getServerSupabaseConfig()?.serviceRoleKey);
}

export function createRequestIds(request: Request) {
  const requestId = request.headers.get("x-request-id") || randomUUID();
  const operationId = request.headers.get("x-operation-id") || randomUUID();
  return { requestId, operationId };
}

export async function getWalletBalance(userId: string): Promise<Wallet> {
  if (shouldUseMemoryTokenStore()) {
    const wallet = testWallets.get(userId) ?? {
      available_balance: getLocalTokenBalance(),
      reserved_balance: 0,
      lifetime_granted: getLocalTokenBalance(),
      lifetime_consumed: 0,
    };
    testWallets.set(userId, wallet);
    return wallet;
  }

  if (!isTokenSystemConfigured()) {
    return {
      available_balance: 0,
      reserved_balance: 0,
      lifetime_granted: 0,
      lifetime_consumed: 0,
    };
  }

  const supabase = createSupabaseServiceClient();
  await supabase.rpc("ensure_token_wallet", { p_user_id: userId });
  await ensureInitialGrant(userId);
  const { data, error } = await supabase
    .from("token_wallets")
    .select(
      "available_balance, reserved_balance, lifetime_granted, lifetime_consumed",
    )
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data as Wallet;
}

async function ensureInitialGrant(userId: string): Promise<void> {
  const grantAmount = Number(process.env.APP_SIGNUP_GRANT_TOKENS ?? 0);
  if (!Number.isFinite(grantAmount) || grantAmount <= 0) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("token_ledger")
    .select("id")
    .eq("user_id", userId)
    .eq("feature", "signup-grant")
    .limit(1);
  if (error) {
    throw error;
  }
  if (data?.length) {
    return;
  }

  const { error: grantError } = await supabase.rpc("grant_tokens", {
    p_user_id: userId,
    p_amount: Math.floor(grantAmount),
    p_request_id: `signup-grant:${userId}`,
    p_feature: "signup-grant",
    p_metadata: { source: "APP_SIGNUP_GRANT_TOKENS" },
  });
  if (grantError) {
    throw grantError;
  }
}

export async function listUsageEvents(userId: string, limit = 30) {
  if (shouldUseMemoryTokenStore() || !isTokenSystemConfigured()) {
    return [];
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("ai_usage_events")
    .select(
      "created_at, feature, model, calculated_app_tokens, status, latency_ms",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as UsageEventRow[];
}

export async function listLedgerEvents(userId: string, limit = 30) {
  if (shouldUseMemoryTokenStore() || !isTokenSystemConfigured()) {
    return [];
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("token_ledger")
    .select(
      "created_at, event_type, amount, available_balance_after, reserved_balance_after, feature, model",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as LedgerEventRow[];
}

export async function reserveAiTokens({
  userId,
  requestId,
  operationId,
  feature,
  provider,
  model,
  estimatedAmount,
  metadata,
}: {
  userId: string;
  requestId: string;
  operationId: string;
  feature: AiFeature;
  provider: string;
  model: string;
  estimatedAmount: number;
  metadata?: Record<string, unknown>;
}): Promise<TokenReservation> {
  const rateCard = await getRateCard(feature, model);
  const reservedAmount = Math.max(1, Math.ceil(estimatedAmount));

  if (shouldUseMemoryTokenStore()) {
    const wallet = await getWalletBalance(userId);
    const existing = testReservations.get(requestId);
    if (existing) {
      if (existing.userId !== userId) {
        throw new Error("duplicate_request_id_for_different_user");
      }
      return existing;
    }
    if (wallet.available_balance < reservedAmount) {
      throw new TokenBalanceError(insufficientBalanceMessage);
    }
    wallet.available_balance -= reservedAmount;
    wallet.reserved_balance += reservedAmount;
    const reservation = {
      requestId,
      operationId,
      userId,
      feature,
      provider,
      model,
      rateCard,
      reservedAmount,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      startedAt: Date.now(),
      status: "reserved",
    };
    testReservations.set(requestId, reservation);
    return reservation;
  }

  if (!isTokenSystemConfigured()) {
    throw new TokenBalanceError(
      "トークン管理のSupabase設定が不足しています。",
      503,
    );
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc("reserve_tokens", {
    p_user_id: userId,
    p_request_id: requestId,
    p_operation_id: operationId,
    p_feature: feature,
    p_model: model,
    p_rate_card_version: rateCard.version,
    p_amount: reservedAmount,
    p_metadata: metadata ?? {},
  });

  if (error) {
    if (error.message.includes("insufficient_token_balance")) {
      throw new TokenBalanceError(insufficientBalanceMessage);
    }
    throw error;
  }

  const reservationRow = (Array.isArray(data) ? data[0] : data) as
    | { reserved_amount?: number; expires_at?: string }
    | null;
  return {
    requestId,
    operationId,
    userId,
    feature,
    provider,
    model,
    rateCard,
    reservedAmount: Number(reservationRow?.reserved_amount ?? reservedAmount),
    expiresAt: String(reservationRow?.expires_at ?? ""),
    startedAt: Date.now(),
  };
}

export async function reconcileExpiredTokenReservations(limit = 100): Promise<{
  released: number;
  reservations: Array<{
    request_id: string;
    user_id: string;
    released_amount: number;
  }>;
}> {
  if (shouldUseMemoryTokenStore()) {
    return { released: 0, reservations: [] };
  }

  if (!isTokenSystemConfigured()) {
    throw new Error("トークン管理のSupabase設定が不足しています。");
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc(
    "release_expired_token_reservations",
    {
      p_limit: Math.max(1, Math.min(Math.floor(limit), 1000)),
    },
  );

  if (error) {
    throw error;
  }

  const reservations = (data ?? []) as unknown as Array<{
    request_id: string;
    user_id: string;
    released_amount: number;
  }>;
  return {
    released: reservations.length,
    reservations,
  };
}

export async function settleAiTokens(
  reservation: TokenReservation,
  usage: UsageParts,
  status: "success" | "failed" = "success",
) {
  const actualAmount =
    status === "success"
      ? calculateAppTokens(usage, reservation.rateCard)
      : 0;
  const latencyMs = Date.now() - reservation.startedAt;

  if (shouldUseMemoryTokenStore()) {
    const wallet = await getWalletBalance(reservation.userId);
    const stored = testReservations.get(reservation.requestId);
    if (!stored || stored.status !== "reserved") {
      return;
    }
    const refund = Math.max(reservation.reservedAmount - actualAmount, 0);
    wallet.available_balance += refund;
    wallet.reserved_balance -= reservation.reservedAmount;
    wallet.lifetime_consumed += actualAmount;
    stored.status = "settled";
    return;
  }

  if (!isTokenSystemConfigured()) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const { error: eventError } = await supabase.from("ai_usage_events").insert({
    request_id: reservation.requestId,
    operation_id: reservation.operationId,
    user_id: reservation.userId,
    feature: reservation.feature,
    provider: reservation.provider,
    model: reservation.model,
    input_tokens: usage.inputTokens ?? 0,
    cached_input_tokens: usage.cachedInputTokens ?? 0,
    output_tokens: usage.outputTokens ?? 0,
    reasoning_tokens: usage.reasoningTokens ?? 0,
    audio_seconds: usage.audioSeconds ?? 0,
    web_search_calls: usage.webSearchCalls ?? 0,
    calculated_app_tokens: actualAmount,
    status,
    latency_ms: latencyMs,
  });
  if (eventError) {
    throw eventError;
  }

  const { error } = await supabase.rpc("settle_tokens", {
    p_request_id: reservation.requestId,
    p_actual_amount: actualAmount,
    p_metadata: { status, latencyMs },
  });

  if (error) {
    throw error;
  }
}

export async function releaseAiTokenReservation(
  reservation: TokenReservation,
  reason: string,
) {
  if (shouldUseMemoryTokenStore()) {
    const wallet = await getWalletBalance(reservation.userId);
    const stored = testReservations.get(reservation.requestId);
    if (!stored || stored.status !== "reserved") {
      return;
    }
    wallet.available_balance += reservation.reservedAmount;
    wallet.reserved_balance -= reservation.reservedAmount;
    stored.status = "released";
    return;
  }

  if (!isTokenSystemConfigured()) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  await supabase.from("ai_usage_events").insert({
    request_id: reservation.requestId,
    operation_id: reservation.operationId,
    user_id: reservation.userId,
    feature: reservation.feature,
    provider: reservation.provider,
    model: reservation.model,
    calculated_app_tokens: 0,
    status: "released",
    latency_ms: Date.now() - reservation.startedAt,
  });
  const { error } = await supabase.rpc("release_token_reservation", {
    p_request_id: reservation.requestId,
    p_metadata: { reason },
  });

  if (error) {
    throw error;
  }
}

export class TokenBalanceError extends Error {
  status: number;

  constructor(message = insufficientBalanceMessage, status = 402) {
    super(message);
    this.name = "TokenBalanceError";
    this.status = status;
  }
}

async function getRateCard(
  feature: AiFeature,
  model: string,
): Promise<TokenRateCard> {
  if (shouldUseMemoryTokenStore() || !isTokenSystemConfigured()) {
    return fallbackRateCard;
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("token_rate_cards")
    .select(
      "version, input_token_multiplier, cached_input_token_multiplier, output_token_multiplier, reasoning_token_multiplier, audio_second_multiplier, web_search_multiplier",
    )
    .eq("active", true)
    .eq("feature", feature)
    .in("model", [model, "*"])
    .order("model", { ascending: false })
    .order("active_from", { ascending: false })
    .limit(1);

  if (error || !data?.[0]) {
    return fallbackRateCard;
  }

  const card = data[0] as Record<string, unknown>;
  return {
    version: String(card.version ?? fallbackRateCard.version),
    inputTokenMultiplier: Number(card.input_token_multiplier ?? 1),
    cachedInputTokenMultiplier: Number(
      card.cached_input_token_multiplier ?? 0.25,
    ),
    outputTokenMultiplier: Number(card.output_token_multiplier ?? 4),
    reasoningTokenMultiplier: Number(card.reasoning_token_multiplier ?? 4),
    audioSecondMultiplier: Number(
      card.audio_second_multiplier ?? fallbackRateCard.audioSecondMultiplier,
    ),
    webSearchMultiplier: Number(
      card.web_search_multiplier ?? fallbackRateCard.webSearchMultiplier,
    ),
  };
}

function getLocalTokenBalance(): number {
  const configured = Number(process.env.LOCAL_TOKEN_BALANCE ?? 100000000);
  if (!Number.isFinite(configured) || configured <= 0) {
    return 100000000;
  }
  return Math.floor(configured);
}
