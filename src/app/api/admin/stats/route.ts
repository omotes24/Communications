import { createHash, createHmac } from "node:crypto";

import { requireAdminApiUser } from "@/lib/auth/admin";
import {
  publicRecentPurchases,
  type PrivatePurchaseRow,
} from "@/lib/admin/public-stats";
import {
  estimateOpenAiCostUsd,
  getOpenAiPricingReference,
} from "@/lib/billing/openai-cost";
import { toPublicError } from "@/lib/privacy/logging";
import { privateJson } from "@/lib/privacy/private-response";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProfileRow = {
  user_id: string;
  created_at: string;
  updated_at: string;
};

type WalletRow = {
  user_id: string;
  available_balance: number;
  reserved_balance: number;
  lifetime_granted: number;
  lifetime_consumed: number;
};

type UsageRow = {
  user_id: string;
  feature: string;
  model: string;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  audio_seconds: number;
  web_search_calls: number;
  calculated_app_tokens: number;
  status: string;
  latency_ms: number | null;
  created_at: string;
};

type GrantRow = PrivatePurchaseRow;

type LedgerRow = {
  event_type: string;
  amount: number;
  feature: string | null;
  model: string | null;
  created_at: string;
};

type UsageAggregate = {
  requests: number;
  tokens: number;
  failed: number;
  latencyMsTotal: number;
  latencyCount: number;
  costUsd: number;
  pricedRequests: number;
};

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function anonymousAccountCode(userId: string): string {
  const secret = process.env.ADMIN_AUDIT_HMAC_SECRET?.trim();
  const digest = secret
    ? createHmac("sha256", secret).update(userId).digest("hex")
    : createHash("sha256").update(userId).digest("hex");
  return `yfy_${digest.slice(0, 12)}`;
}

function emptyAggregate(): UsageAggregate {
  return {
    requests: 0,
    tokens: 0,
    failed: 0,
    latencyMsTotal: 0,
    latencyCount: 0,
    costUsd: 0,
    pricedRequests: 0,
  };
}

function addUsage(
  aggregate: UsageAggregate,
  usage: UsageRow,
  costUsd: number,
  priced: boolean,
) {
  aggregate.requests += 1;
  aggregate.tokens += Number(usage.calculated_app_tokens || 0);
  aggregate.costUsd += costUsd;
  if (priced) aggregate.pricedRequests += 1;
  if (usage.status === "failed") aggregate.failed += 1;
  if (typeof usage.latency_ms === "number") {
    aggregate.latencyMsTotal += usage.latency_ms;
    aggregate.latencyCount += 1;
  }
}

function publicAggregate(aggregate: UsageAggregate) {
  return {
    requests: aggregate.requests,
    tokens: aggregate.tokens,
    failed: aggregate.failed,
    avgLatencyMs: aggregate.latencyCount
      ? Math.round(aggregate.latencyMsTotal / aggregate.latencyCount)
      : null,
    estimatedCostUsd: Number(aggregate.costUsd.toFixed(6)),
    pricedRequests: aggregate.pricedRequests,
  };
}

export async function GET(): Promise<Response> {
  const auth = await requireAdminApiUser();
  if (!auth.ok) return auth.response;

  if (!getServerSupabaseConfig()?.serviceRoleKey) {
    return privateJson({
      configured: false,
      generatedAt: new Date().toISOString(),
    });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const since30d = isoDaysAgo(30);
    const since7d = isoDaysAgo(7);
    const since24h = isoDaysAgo(1);
    const usdJpyRate = positiveNumber(process.env.OPENAI_USD_JPY_RATE, 150);
    const webSearchUsdPerCall = positiveNumber(
      process.env.OPENAI_WEB_SEARCH_USD_PER_CALL,
      0.01,
    );

    const [
      profilesResult,
      walletsResult,
      grantsResult,
      usageResult,
      ledgerResult,
      reservationsResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, created_at, updated_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(10_000),
      supabase
        .from("token_wallets")
        .select(
          "user_id, available_balance, reserved_balance, lifetime_granted, lifetime_consumed",
        )
        .limit(10_000),
      supabase
        .from("stripe_checkout_grants")
        .select(
          "user_id, amount_jpy, token_amount, plan_id, livemode, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(10_000),
      supabase
        .from("ai_usage_events")
        .select(
          "user_id, feature, model, input_tokens, cached_input_tokens, output_tokens, reasoning_tokens, audio_seconds, web_search_calls, calculated_app_tokens, status, latency_ms, created_at",
        )
        .gte("created_at", since30d)
        .order("created_at", { ascending: false })
        .limit(20_000),
      supabase
        .from("token_ledger")
        .select("event_type, amount, feature, model, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("token_reservations")
        .select("id", { count: "exact", head: true })
        .eq("status", "reserved"),
    ]);

    const firstError =
      profilesResult.error ??
      walletsResult.error ??
      grantsResult.error ??
      usageResult.error ??
      ledgerResult.error ??
      reservationsResult.error;
    if (firstError) throw new Error(firstError.message);

    const profiles = (profilesResult.data ?? []) as ProfileRow[];
    const wallets = (walletsResult.data ?? []) as WalletRow[];
    const grants = (grantsResult.data ?? []) as GrantRow[];
    const usage = (usageResult.data ?? []) as UsageRow[];

    const walletTotals = wallets.reduce(
      (total, wallet) => ({
        available: total.available + Number(wallet.available_balance || 0),
        reserved: total.reserved + Number(wallet.reserved_balance || 0),
        granted: total.granted + Number(wallet.lifetime_granted || 0),
        consumed: total.consumed + Number(wallet.lifetime_consumed || 0),
      }),
      { available: 0, reserved: 0, granted: 0, consumed: 0 },
    );

    const revenueTotalJpy = grants.reduce(
      (sum, grant) => sum + Number(grant.amount_jpy || 0),
      0,
    );
    const revenue30dJpy = grants
      .filter((grant) => grant.created_at >= since30d)
      .reduce((sum, grant) => sum + Number(grant.amount_jpy || 0), 0);

    const total30d = emptyAggregate();
    const total7d = emptyAggregate();
    const total24h = emptyAggregate();
    const byFeature = new Map<string, UsageAggregate>();
    const byModel = new Map<string, UsageAggregate>();
    const byDay = new Map<string, UsageAggregate>();
    const byUser = new Map<string, UsageAggregate>();

    for (const event of usage) {
      const estimated = estimateOpenAiCostUsd(
        {
          model: event.model,
          inputTokens: Number(event.input_tokens || 0),
          cachedInputTokens: Number(event.cached_input_tokens || 0),
          outputTokens: Number(event.output_tokens || 0),
          audioSeconds: Number(event.audio_seconds || 0),
          webSearchCalls: Number(event.web_search_calls || 0),
        },
        webSearchUsdPerCall,
      );

      addUsage(total30d, event, estimated.costUsd, estimated.priced);
      if (event.created_at >= since7d) {
        addUsage(total7d, event, estimated.costUsd, estimated.priced);
      }
      if (event.created_at >= since24h) {
        addUsage(total24h, event, estimated.costUsd, estimated.priced);
      }

      const feature = byFeature.get(event.feature) ?? emptyAggregate();
      addUsage(feature, event, estimated.costUsd, estimated.priced);
      byFeature.set(event.feature, feature);

      const model = byModel.get(event.model) ?? emptyAggregate();
      addUsage(model, event, estimated.costUsd, estimated.priced);
      byModel.set(event.model, model);

      const dayKey = event.created_at.slice(0, 10);
      const day = byDay.get(dayKey) ?? emptyAggregate();
      addUsage(day, event, estimated.costUsd, estimated.priced);
      byDay.set(dayKey, day);

      const account = byUser.get(event.user_id) ?? emptyAggregate();
      addUsage(account, event, estimated.costUsd, estimated.priced);
      byUser.set(event.user_id, account);
    }

    const cost30dJpy = total30d.costUsd * usdJpyRate;
    const margin30dJpy = revenue30dJpy - cost30dJpy;
    const marginPercent = revenue30dJpy
      ? (margin30dJpy / revenue30dJpy) * 100
      : null;

    const walletsByUser = new Map(
      wallets.map((wallet) => [wallet.user_id, wallet]),
    );
    const purchasesByUser = new Map<
      string,
      {
        totalJpy: number;
        purchaseCount: number;
        purchasedTokens: number;
        lastPurchasedAt: string | null;
      }
    >();
    for (const grant of grants) {
      const customer = purchasesByUser.get(grant.user_id) ?? {
        totalJpy: 0,
        purchaseCount: 0,
        purchasedTokens: 0,
        lastPurchasedAt: null,
      };
      customer.totalJpy += Number(grant.amount_jpy || 0);
      customer.purchaseCount += 1;
      customer.purchasedTokens += Number(grant.token_amount || 0);
      if (
        !customer.lastPurchasedAt ||
        grant.created_at > customer.lastPurchasedAt
      ) {
        customer.lastPurchasedAt = grant.created_at;
      }
      purchasesByUser.set(grant.user_id, customer);
    }

    const customerMetrics = profiles.map((profile) => {
      const purchases = purchasesByUser.get(profile.user_id) ?? {
        totalJpy: 0,
        purchaseCount: 0,
        purchasedTokens: 0,
        lastPurchasedAt: null,
      };
      const wallet = walletsByUser.get(profile.user_id);
      const activity = byUser.get(profile.user_id) ?? emptyAggregate();
      return {
        anonymousId: anonymousAccountCode(profile.user_id),
        signedUpAt: profile.created_at,
        totalPurchaseJpy: purchases.totalJpy,
        purchaseCount: purchases.purchaseCount,
        purchasedTokens: purchases.purchasedTokens,
        lastPurchasedAt: purchases.lastPurchasedAt,
        availableTokens: Number(wallet?.available_balance || 0),
        lifetimeConsumedTokens: Number(wallet?.lifetime_consumed || 0),
        requests30d: activity.requests,
        appTokens30d: activity.tokens,
        estimatedCostUsd30d: Number(activity.costUsd.toFixed(6)),
      };
    });

    return privateJson({
      configured: true,
      generatedAt: new Date().toISOString(),
      users: {
        total: profilesResult.count ?? profiles.length,
        recent: profiles.slice(0, 12).map((profile) => ({
          anonymousId: anonymousAccountCode(profile.user_id),
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        })),
      },
      wallets: {
        count: wallets.length,
        totalAvailable: walletTotals.available,
        totalReserved: walletTotals.reserved,
        lifetimeGranted: walletTotals.granted,
        lifetimeConsumed: walletTotals.consumed,
      },
      revenue: {
        totalJpy: revenueTotalJpy,
        last30dJpy: revenue30dJpy,
        purchases: grants.length,
        recent: publicRecentPurchases(grants),
      },
      economics: {
        estimatedOpenAiCost30dUsd: Number(total30d.costUsd.toFixed(4)),
        estimatedOpenAiCost30dJpy: Math.round(cost30dJpy),
        estimatedGrossMargin30dJpy: Math.round(margin30dJpy),
        estimatedGrossMarginPercent:
          marginPercent == null ? null : Number(marginPercent.toFixed(1)),
        usdJpyRate,
        costCoveragePercent: total30d.requests
          ? Number(
              ((total30d.pricedRequests / total30d.requests) * 100).toFixed(1),
            )
          : 100,
      },
      usage: {
        last24h: publicAggregate(total24h),
        last7d: publicAggregate(total7d),
        last30d: publicAggregate(total30d),
        byFeature: Array.from(byFeature.entries())
          .map(([feature, aggregate]) => ({
            feature,
            ...publicAggregate(aggregate),
          }))
          .sort((a, b) => b.tokens - a.tokens),
        byModel: Array.from(byModel.entries())
          .map(([model, aggregate]) => ({
            model,
            ...publicAggregate(aggregate),
          }))
          .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd),
        byDay: Array.from(byDay.entries())
          .map(([day, aggregate]) => ({
            day,
            ...publicAggregate(aggregate),
          }))
          .sort((a, b) => (a.day < b.day ? 1 : -1))
          .slice(0, 14),
        topConsumers: Array.from(byUser.entries())
          .map(([userId, aggregate]) => ({
            anonymousId: anonymousAccountCode(userId),
            ...publicAggregate(aggregate),
          }))
          .sort((a, b) => b.tokens - a.tokens)
          .slice(0, 10),
      },
      customers: {
        purchasers: customerMetrics.filter(
          (customer) => customer.purchaseCount > 0,
        ).length,
        repeatPurchasers: customerMetrics.filter(
          (customer) => customer.purchaseCount > 1,
        ).length,
        averageRevenuePerPurchaserJpy: purchasesByUser.size
          ? Math.round(revenueTotalJpy / purchasesByUser.size)
          : 0,
        topByRevenue: customerMetrics
          .filter((customer) => customer.purchaseCount > 0)
          .sort((a, b) => b.totalPurchaseJpy - a.totalPurchaseJpy)
          .slice(0, 10),
      },
      reservations: { active: reservationsResult.count ?? 0 },
      recentLedger: (ledgerResult.data ?? []) as LedgerRow[],
      privacy: {
        accountIdentifiers: "HMAC/SHA-256 pseudonyms only",
        hmacConfigured: Boolean(process.env.ADMIN_AUDIT_HMAC_SECRET?.trim()),
        rawPromptsIncluded: false,
        rawAudioIncluded: false,
      },
      pricing: {
        ...getOpenAiPricingReference(),
        webSearchUsdPerCall,
      },
    });
  } catch (error) {
    return privateJson({ error: toPublicError(error) }, { status: 500 });
  }
}
