import { requireAdminApiUser } from "@/lib/auth/admin";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { toPublicError } from "@/lib/privacy/logging";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WalletRow = {
  available_balance: number;
  reserved_balance: number;
  lifetime_granted: number;
  lifetime_consumed: number;
};

type UsageRow = {
  feature: string;
  model: string;
  calculated_app_tokens: number;
  status: string;
  latency_ms: number | null;
  created_at: string;
};

type GrantRow = {
  amount_jpy: number;
  token_amount: number;
  plan_id: string;
  livemode: boolean;
  created_at: string;
};

type LedgerRow = {
  event_type: string;
  amount: number;
  feature: string | null;
  model: string | null;
  created_at: string;
};

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function GET(): Promise<Response> {
  const auth = await requireAdminApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  // ローカル開発（Supabase未設定）はダミーではなく明示的に未設定と返す
  if (!getServerSupabaseConfig()?.serviceRoleKey) {
    return Response.json({
      configured: false,
      generatedAt: new Date().toISOString(),
    });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const since30d = isoDaysAgo(30);
    const since7d = isoDaysAgo(7);

    const [
      usersResult,
      walletsResult,
      grantsResult,
      usageResult,
      ledgerResult,
      reservationsResult,
    ] = await Promise.all([
      supabase.from("profiles").select("user_id", { count: "exact", head: true }),
      supabase
        .from("token_wallets")
        .select(
          "available_balance, reserved_balance, lifetime_granted, lifetime_consumed",
        )
        .limit(10000),
      supabase
        .from("stripe_checkout_grants")
        .select("amount_jpy, token_amount, plan_id, livemode, created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("ai_usage_events")
        .select("feature, model, calculated_app_tokens, status, latency_ms, created_at")
        .gte("created_at", since7d)
        .order("created_at", { ascending: false })
        .limit(5000),
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
      usersResult.error ??
      walletsResult.error ??
      grantsResult.error ??
      usageResult.error ??
      ledgerResult.error ??
      reservationsResult.error;
    if (firstError) {
      throw new Error(firstError.message);
    }

    const wallets = (walletsResult.data ?? []) as WalletRow[];
    const walletTotals = wallets.reduce(
      (acc, w) => {
        acc.available += w.available_balance;
        acc.reserved += w.reserved_balance;
        acc.granted += w.lifetime_granted;
        acc.consumed += w.lifetime_consumed;
        return acc;
      },
      { available: 0, reserved: 0, granted: 0, consumed: 0 },
    );

    const grants = (grantsResult.data ?? []) as GrantRow[];
    const revenueTotalJpy = grants.reduce((sum, g) => sum + g.amount_jpy, 0);
    const revenue30dJpy = grants
      .filter((g) => g.created_at >= since30d)
      .reduce((sum, g) => sum + g.amount_jpy, 0);

    const usage = (usageResult.data ?? []) as UsageRow[];
    const since24h = isoDaysAgo(1);
    const usage24h = usage.filter((u) => u.created_at >= since24h);

    const byFeature = new Map<
      string,
      { requests: number; tokens: number; failed: number; latencyMsTotal: number; latencyCount: number }
    >();
    for (const u of usage) {
      const entry = byFeature.get(u.feature) ?? {
        requests: 0,
        tokens: 0,
        failed: 0,
        latencyMsTotal: 0,
        latencyCount: 0,
      };
      entry.requests += 1;
      entry.tokens += u.calculated_app_tokens;
      if (u.status === "failed") {
        entry.failed += 1;
      }
      if (typeof u.latency_ms === "number") {
        entry.latencyMsTotal += u.latency_ms;
        entry.latencyCount += 1;
      }
      byFeature.set(u.feature, entry);
    }

    const byDay = new Map<string, { requests: number; tokens: number }>();
    for (const u of usage) {
      const day = u.created_at.slice(0, 10);
      const entry = byDay.get(day) ?? { requests: 0, tokens: 0 };
      entry.requests += 1;
      entry.tokens += u.calculated_app_tokens;
      byDay.set(day, entry);
    }

    return Response.json({
      configured: true,
      generatedAt: new Date().toISOString(),
      users: { total: usersResult.count ?? 0 },
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
        recent: grants.slice(0, 10),
      },
      usage: {
        last24h: {
          requests: usage24h.length,
          tokens: usage24h.reduce((s, u) => s + u.calculated_app_tokens, 0),
        },
        last7d: {
          requests: usage.length,
          tokens: usage.reduce((s, u) => s + u.calculated_app_tokens, 0),
        },
        byFeature: Array.from(byFeature.entries())
          .map(([feature, v]) => ({
            feature,
            requests: v.requests,
            tokens: v.tokens,
            failed: v.failed,
            avgLatencyMs: v.latencyCount
              ? Math.round(v.latencyMsTotal / v.latencyCount)
              : null,
          }))
          .sort((a, b) => b.tokens - a.tokens),
        byDay: Array.from(byDay.entries())
          .map(([day, v]) => ({ day, ...v }))
          .sort((a, b) => (a.day < b.day ? 1 : -1)),
      },
      reservations: { active: reservationsResult.count ?? 0 },
      recentLedger: (ledgerResult.data ?? []) as LedgerRow[],
    });
  } catch (error) {
    return Response.json({ error: toPublicError(error) }, { status: 500 });
  }
}
