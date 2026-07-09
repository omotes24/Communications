"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Coins,
  JapaneseYen,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";

const REFRESH_INTERVAL_MS = 30_000;

type AdminStats = {
  configured: boolean;
  generatedAt: string;
  users?: { total: number };
  wallets?: {
    count: number;
    totalAvailable: number;
    totalReserved: number;
    lifetimeGranted: number;
    lifetimeConsumed: number;
  };
  revenue?: {
    totalJpy: number;
    last30dJpy: number;
    purchases: number;
    recent: {
      amount_jpy: number;
      token_amount: number;
      plan_id: string;
      livemode: boolean;
      created_at: string;
    }[];
  };
  usage?: {
    last24h: { requests: number; tokens: number };
    last7d: { requests: number; tokens: number };
    byFeature: {
      feature: string;
      requests: number;
      tokens: number;
      failed: number;
      avgLatencyMs: number | null;
    }[];
    byDay: { day: string; requests: number; tokens: number }[];
  };
  reservations?: { active: number };
  recentLedger?: {
    event_type: string;
    amount: number;
    feature: string | null;
    model: string | null;
    created_at: string;
  }[];
};

function formatNumber(value: number | undefined): string {
  return (value ?? 0).toLocaleString("ja-JP");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.08]">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[#1d1d1f]">
        {value}
      </p>
      {sub ? (
        <p className="mt-1 text-xs font-medium text-[#6e6e73]">{sub}</p>
      ) : null}
    </div>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/stats", { cache: "no-store" });
      const data = (await response.json()) as AdminStats & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "統計を取得できませんでした。");
      }
      setStats(data);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "統計を取得できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

  return (
    <div>
      <PageHeader
        title="管理ダッシュボード"
        description="トークン残高・使用量・売上をリアルタイムに確認できます（30秒ごとに自動更新）。"
        descriptionClassName="text-[#1d1d1f]"
        compact
      />

      <div className="mb-4 flex items-center gap-3 text-xs font-medium text-[#6e6e73]">
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 font-semibold text-[#1d1d1f] shadow-sm ring-1 ring-black/[0.08] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          今すぐ更新
        </button>
        {stats ? <span>最終更新: {formatDateTime(stats.generatedAt)}</span> : null}
      </div>

      {error ? (
        <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      {stats && !stats.configured ? (
        <p className="rounded-3xl bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-800">
          Supabase（SUPABASE_SERVICE_ROLE_KEY）が未設定のため統計を表示できません。
          ローカル開発ではトークン台帳を使っていないためです。本番デプロイでは自動的に表示されます。
        </p>
      ) : null}

      {stats?.configured ? (
        <div className="grid gap-4">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label="ユーザー"
              value={formatNumber(stats.users?.total)}
              sub={`ウォレット ${formatNumber(stats.wallets?.count)}件`}
            />
            <StatCard
              icon={Coins}
              label="トークン残高合計"
              value={formatNumber(stats.wallets?.totalAvailable)}
              sub={`予約中 ${formatNumber(stats.wallets?.totalReserved)} / 実行中リクエスト ${formatNumber(stats.reservations?.active)}件`}
            />
            <StatCard
              icon={Activity}
              label="消費（24時間）"
              value={formatNumber(stats.usage?.last24h.tokens)}
              sub={`${formatNumber(stats.usage?.last24h.requests)}リクエスト / 7日間 ${formatNumber(stats.usage?.last7d.tokens)}`}
            />
            <StatCard
              icon={JapaneseYen}
              label="売上（30日）"
              value={`¥${formatNumber(stats.revenue?.last30dJpy)}`}
              sub={`累計 ¥${formatNumber(stats.revenue?.totalJpy)}（${formatNumber(stats.revenue?.purchases)}件）`}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.08]">
              <h2 className="text-lg font-semibold tracking-tight">
                機能別の使用量（7日間）
              </h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">
                    <tr>
                      <th className="py-2 pr-4">機能</th>
                      <th className="py-2 pr-4">回数</th>
                      <th className="py-2 pr-4">トークン</th>
                      <th className="py-2 pr-4">失敗</th>
                      <th className="py-2">平均応答</th>
                    </tr>
                  </thead>
                  <tbody className="font-medium text-[#1d1d1f]">
                    {(stats.usage?.byFeature ?? []).map((row) => (
                      <tr key={row.feature} className="border-t border-black/[0.06]">
                        <td className="py-2 pr-4">{row.feature}</td>
                        <td className="py-2 pr-4">{formatNumber(row.requests)}</td>
                        <td className="py-2 pr-4">{formatNumber(row.tokens)}</td>
                        <td className="py-2 pr-4">{formatNumber(row.failed)}</td>
                        <td className="py-2">
                          {row.avgLatencyMs != null
                            ? `${(row.avgLatencyMs / 1000).toFixed(1)}秒`
                            : "-"}
                        </td>
                      </tr>
                    ))}
                    {!stats.usage?.byFeature.length ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-[#6e6e73]">
                          直近7日間の使用はありません。
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.08]">
              <h2 className="text-lg font-semibold tracking-tight">
                日別の使用量（7日間）
              </h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">
                    <tr>
                      <th className="py-2 pr-4">日付</th>
                      <th className="py-2 pr-4">回数</th>
                      <th className="py-2">トークン</th>
                    </tr>
                  </thead>
                  <tbody className="font-medium text-[#1d1d1f]">
                    {(stats.usage?.byDay ?? []).map((row) => (
                      <tr key={row.day} className="border-t border-black/[0.06]">
                        <td className="py-2 pr-4">{row.day}</td>
                        <td className="py-2 pr-4">{formatNumber(row.requests)}</td>
                        <td className="py-2">{formatNumber(row.tokens)}</td>
                      </tr>
                    ))}
                    {!stats.usage?.byDay.length ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-[#6e6e73]">
                          直近7日間の使用はありません。
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.08]">
              <h2 className="text-lg font-semibold tracking-tight">最近の購入</h2>
              <div className="mt-3 grid gap-2 text-sm font-medium text-[#1d1d1f]">
                {(stats.revenue?.recent ?? []).map((grant, index) => (
                  <div
                    key={`${grant.created_at}-${index}`}
                    className="flex items-center justify-between rounded-2xl bg-[#f5f5f7] px-4 py-2.5"
                  >
                    <span>
                      ¥{formatNumber(grant.amount_jpy)}（{grant.plan_id}
                      {grant.livemode ? "" : "・テスト"}）
                    </span>
                    <span className="text-xs text-[#6e6e73]">
                      +{formatNumber(grant.token_amount)}トークン ／{" "}
                      {formatDateTime(grant.created_at)}
                    </span>
                  </div>
                ))}
                {!stats.revenue?.recent.length ? (
                  <p className="py-3 text-[#6e6e73]">購入履歴はまだありません。</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.08]">
              <h2 className="text-lg font-semibold tracking-tight">
                最近のトークンイベント
              </h2>
              <div className="mt-3 grid gap-2 text-sm font-medium text-[#1d1d1f]">
                {(stats.recentLedger ?? []).map((event, index) => (
                  <div
                    key={`${event.created_at}-${index}`}
                    className="flex items-center justify-between rounded-2xl bg-[#f5f5f7] px-4 py-2.5"
                  >
                    <span>
                      {event.event_type}
                      {event.feature ? `（${event.feature}）` : ""}
                    </span>
                    <span className="text-xs text-[#6e6e73]">
                      {event.amount > 0 ? "+" : ""}
                      {formatNumber(event.amount)} ／{" "}
                      {formatDateTime(event.created_at)}
                    </span>
                  </div>
                ))}
                {!stats.recentLedger?.length ? (
                  <p className="py-3 text-[#6e6e73]">イベントはまだありません。</p>
                ) : null}
              </div>
            </div>
          </section>

          <p className="text-xs font-medium text-[#6e6e73]">
            管理者は環境変数 ADMIN_EMAILS（カンマ区切りのメールアドレス）で指定します。
            トークンの消費内訳は消費履歴（token_ledger / ai_usage_events）に基づきます。
          </p>
        </div>
      ) : null}
    </div>
  );
}
