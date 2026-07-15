"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BrainCircuit,
  Coins,
  Database,
  Download,
  JapaneseYen,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { AdminSectionNav } from "@/components/admin/AdminSectionNav";

const REFRESH_INTERVAL_MS = 30_000;

type Aggregate = {
  requests: number;
  tokens: number;
  failed: number;
  avgLatencyMs: number | null;
  estimatedCostUsd: number;
  pricedRequests: number;
};
type Customer = {
  anonymousId: string;
  signedUpAt: string;
  totalPurchaseJpy: number;
  purchaseCount: number;
  purchasedTokens: number;
  lastPurchasedAt: string | null;
  availableTokens: number;
  lifetimeConsumedTokens: number;
  requests30d: number;
  appTokens30d: number;
  estimatedCostUsd30d: number;
};
type AdminStats = {
  configured: boolean;
  generatedAt: string;
  users?: {
    total: number;
    recent: { anonymousId: string; createdAt: string; updatedAt: string }[];
  };
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
  economics?: {
    estimatedOpenAiCost30dUsd: number;
    estimatedOpenAiCost30dJpy: number;
    estimatedGrossMargin30dJpy: number;
    estimatedGrossMarginPercent: number | null;
    usdJpyRate: number;
    costCoveragePercent: number;
  };
  usage?: {
    last24h: Aggregate;
    last7d: Aggregate;
    last30d: Aggregate;
    byFeature: (Aggregate & { feature: string })[];
    byModel: (Aggregate & { model: string })[];
    byDay: (Aggregate & { day: string })[];
    topConsumers: (Aggregate & { anonymousId: string })[];
  };
  customers?: {
    purchasers: number;
    repeatPurchasers: number;
    averageRevenuePerPurchaserJpy: number;
    topByRevenue: Customer[];
  };
  reservations?: { active: number };
  recentLedger?: {
    event_type: string;
    amount: number;
    feature: string | null;
    model: string | null;
    created_at: string;
  }[];
  privacy?: {
    accountIdentifiers: string;
    hmacConfigured: boolean;
    rawPromptsIncluded: boolean;
    rawAudioIncluded: boolean;
  };
};

const exports = [
  ["customers", "顧客・購入集計"],
  ["purchases", "購入明細"],
  ["usage", "AI使用明細"],
  ["daily", "日次ML特徴量"],
  ["events", "行動イベント"],
  ["interview_experiences", "面接体験・過去問"],
] as const;

const glass =
  "rounded-[20px] border border-white/70 bg-white/65 shadow-[0_10px_52px_rgba(29,29,31,0.10)] backdrop-blur-2xl";

function n(value: number | undefined, maximumFractionDigits = 0): string {
  return (value ?? 0).toLocaleString("ja-JP", { maximumFractionDigits });
}

function dt(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone = "blue",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail: string;
  tone?: "blue" | "violet" | "emerald" | "amber";
}) {
  const tones = {
    blue: "from-blue-500/18 to-cyan-400/8 text-blue-700",
    violet: "from-violet-500/18 to-fuchsia-400/8 text-violet-700",
    emerald: "from-emerald-500/18 to-teal-400/8 text-emerald-700",
    amber: "from-amber-500/20 to-orange-400/8 text-amber-700",
  };
  return (
    <article className={`${glass} overflow-hidden p-5`}>
      <div className={`-m-5 mb-4 bg-gradient-to-br p-5 ${tones[tone]}`}>
        <div className="flex items-center gap-2 text-xs font-bold tracking-[0.16em]">
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </div>
      </div>
      <p className="text-3xl font-semibold tracking-[-0.04em] text-[#1d1d1f]">
        {value}
      </p>
      <p className="mt-2 text-xs font-medium leading-5 text-[#6e6e73]">
        {detail}
      </p>
    </article>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="py-6 text-center text-sm text-[#86868b]">{children}</p>;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/stats", { cache: "no-store" });
      const data = (await response.json()) as AdminStats & { error?: string };
      if (!response.ok)
        throw new Error(data.error ?? "統計を取得できませんでした。");
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

  const maxFeatureTokens = Math.max(
    1,
    ...(stats?.usage?.byFeature.map((row) => row.tokens) ?? []),
  );

  return (
    <div className="pb-10">
      <PageHeader
        title="Management Intelligence"
        description="売上、原価、利用状況、顧客行動を匿名IDで横断分析します。30秒ごとに更新されます。"
        descriptionClassName="text-[#1d1d1f]"
        compact
      />

      <AdminSectionNav active="overview" />

      <div className="mb-5 flex flex-wrap items-center gap-3 text-xs font-medium text-[#6e6e73]">
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/75 px-4 py-2.5 font-semibold text-[#1d1d1f] shadow-sm backdrop-blur-xl transition hover:bg-white disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          更新
        </button>
        {stats ? <span>最終更新 {dt(stats.generatedAt)}</span> : null}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700 ring-1 ring-emerald-600/10">
          <ShieldCheck className="h-3.5 w-3.5" /> 管理者限定・匿名表示
        </span>
      </div>

      {error ? (
        <p className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}
      {stats && !stats.configured ? (
        <p
          className={`${glass} p-6 text-sm font-semibold leading-6 text-amber-800`}
        >
          Supabase Service Roleが未設定のため、本番統計は表示できません。
        </p>
      ) : null}

      {stats?.configured ? (
        <div className="grid gap-5">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={JapaneseYen}
              label="売り上げ"
              value={`¥${n(stats.revenue?.last30dJpy)}`}
              detail={`累計 ¥${n(stats.revenue?.totalJpy)} / ${n(stats.revenue?.purchases)}件`}
              tone="blue"
            />
            <Metric
              icon={TrendingUp}
              label="推定粗利"
              value={`¥${n(stats.economics?.estimatedGrossMargin30dJpy)}`}
              detail={`粗利率 ${stats.economics?.estimatedGrossMarginPercent == null ? "—" : `${n(stats.economics.estimatedGrossMarginPercent, 1)}%`} / 原価カバー ${n(stats.economics?.costCoveragePercent, 1)}%`}
              tone="emerald"
            />
            <Metric
              icon={Users}
              label="利用者"
              value={n(stats.users?.total)}
              detail={`購入者 ${n(stats.customers?.purchasers)} / リピート ${n(stats.customers?.repeatPurchasers)}`}
              tone="violet"
            />
            <Metric
              icon={Coins}
              label="30日消費"
              value={n(stats.usage?.last30d.tokens)}
              detail={`${n(stats.usage?.last30d.requests)}回 / 失敗 ${n(stats.usage?.last30d.failed)}回`}
              tone="amber"
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
            <div className={`${glass} p-6`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-[0.16em] text-blue-700">
                    UNIT ECONOMICS
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight">
                    課金と原価の健全性
                  </h2>
                </div>
                <WalletCards className="h-6 w-6 text-blue-600" />
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-black/[0.05]">
                  <p className="text-xs text-[#6e6e73]">
                    OpenAI推定原価 / 30日
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    ¥{n(stats.economics?.estimatedOpenAiCost30dJpy)}
                  </p>
                  <p className="text-xs text-[#86868b]">
                    ${n(stats.economics?.estimatedOpenAiCost30dUsd, 4)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-black/[0.05]">
                  <p className="text-xs text-[#6e6e73]">ARPP</p>
                  <p className="mt-2 text-xl font-semibold">
                    ¥{n(stats.customers?.averageRevenuePerPurchaserJpy)}
                  </p>
                  <p className="text-xs text-[#86868b]">購入者1人あたり累計</p>
                </div>
                <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-black/[0.05]">
                  <p className="text-xs text-[#6e6e73]">残高 / 予約中</p>
                  <p className="mt-2 text-xl font-semibold">
                    {n(stats.wallets?.totalAvailable)}
                  </p>
                  <p className="text-xs text-[#86868b]">
                    予約 {n(stats.wallets?.totalReserved)} /{" "}
                    {n(stats.reservations?.active)}件
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-[#6e6e73]">
                換算レート: 1 USD = ¥{n(stats.economics?.usdJpyRate)}
                。原価は記録済みモデル使用量からの推定で、Stripe手数料・税・インフラ費は含みません。
              </p>
            </div>

            <div className={`${glass} p-6`}>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-violet-600" />
                <h2 className="text-lg font-semibold">分析CSV</h2>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#6e6e73]">
                UTF-8 BOM・snake_case・匿名ID。既定90日、最大50,000行です。
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {exports.map(([dataset, label]) => (
                  <a
                    key={dataset}
                    href={`/api/admin/export/${dataset}?days=90`}
                    className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold ring-1 ring-black/[0.05] transition hover:bg-white"
                  >
                    {label}
                    <Download className="h-4 w-4 text-blue-600" />
                  </a>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className={`${glass} p-6`}>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold">機能別利用量 / 30日</h2>
              </div>
              <div className="mt-5 grid gap-4">
                {(stats.usage?.byFeature ?? []).map((row) => (
                  <div key={row.feature}>
                    <div className="mb-1.5 flex items-end justify-between gap-3 text-xs">
                      <span className="font-semibold text-[#1d1d1f]">
                        {row.feature}
                      </span>
                      <span className="text-[#6e6e73]">
                        {n(row.tokens)} tokens · {n(row.requests)}回 · $
                        {n(row.estimatedCostUsd, 4)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/[0.05]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                        style={{
                          width: `${Math.max(3, (row.tokens / maxFeatureTokens) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
                {!stats.usage?.byFeature.length ? (
                  <Empty>利用データはまだありません。</Empty>
                ) : null}
              </div>
            </div>

            <div className={`${glass} overflow-hidden p-6`}>
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-violet-600" />
                <h2 className="text-lg font-semibold">モデル別コスト / 30日</h2>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-[#6e6e73]">
                    <tr>
                      <th className="py-2">モデル</th>
                      <th className="py-2 text-right">回数</th>
                      <th className="py-2 text-right">App tokens</th>
                      <th className="py-2 text-right">推定原価</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.usage?.byModel ?? []).map((row) => (
                      <tr
                        key={row.model}
                        className="border-t border-black/[0.05]"
                      >
                        <td className="py-3 font-semibold">{row.model}</td>
                        <td className="py-3 text-right">{n(row.requests)}</td>
                        <td className="py-3 text-right">{n(row.tokens)}</td>
                        <td className="py-3 text-right">
                          ${n(row.estimatedCostUsd, 4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!stats.usage?.byModel.length ? (
                  <Empty>モデル利用はまだありません。</Empty>
                ) : null}
              </div>
            </div>
          </section>

          <section className={`${glass} overflow-hidden p-6`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-violet-700">
                  CUSTOMER 360
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  利用者ごとの購入・利用・原価
                </h2>
              </div>
              <span className="text-xs text-[#6e6e73]">
                メール・氏名・生データは非表示
              </span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-xs text-[#6e6e73]">
                  <tr>
                    <th className="py-2">匿名ID</th>
                    <th className="py-2 text-right">累計購入</th>
                    <th className="py-2 text-right">購入回数</th>
                    <th className="py-2 text-right">購入tokens</th>
                    <th className="py-2 text-right">30日消費</th>
                    <th className="py-2 text-right">30日原価</th>
                    <th className="py-2 text-right">残高</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats.customers?.topByRevenue ?? []).map((row) => (
                    <tr
                      key={row.anonymousId}
                      className="border-t border-black/[0.05]"
                    >
                      <td className="py-3 font-mono text-xs font-semibold text-blue-700">
                        {row.anonymousId}
                      </td>
                      <td className="py-3 text-right font-semibold">
                        ¥{n(row.totalPurchaseJpy)}
                      </td>
                      <td className="py-3 text-right">
                        {n(row.purchaseCount)}
                      </td>
                      <td className="py-3 text-right">
                        {n(row.purchasedTokens)}
                      </td>
                      <td className="py-3 text-right">{n(row.appTokens30d)}</td>
                      <td className="py-3 text-right">
                        ${n(row.estimatedCostUsd30d, 4)}
                      </td>
                      <td className="py-3 text-right">
                        {n(row.availableTokens)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!stats.customers?.topByRevenue.length ? (
                <Empty>購入者はまだいません。</Empty>
              ) : null}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className={`${glass} p-6`}>
              <h2 className="text-lg font-semibold">最近の購入</h2>
              <div className="mt-4 grid gap-2">
                {(stats.revenue?.recent ?? []).map((row, index) => (
                  <div
                    key={`${row.created_at}-${index}`}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-white/65 px-4 py-3 text-sm ring-1 ring-black/[0.04]"
                  >
                    <span className="font-semibold">
                      ¥{n(row.amount_jpy)} · {row.plan_id}
                      {row.livemode ? "" : " · test"}
                    </span>
                    <span className="text-right text-xs text-[#6e6e73]">
                      +{n(row.token_amount)}
                      <br />
                      {dt(row.created_at)}
                    </span>
                  </div>
                ))}
                {!stats.revenue?.recent.length ? (
                  <Empty>購入履歴はありません。</Empty>
                ) : null}
              </div>
            </div>
            <div className={`${glass} p-6`}>
              <h2 className="text-lg font-semibold">最近のトークンイベント</h2>
              <div className="mt-4 grid gap-2">
                {(stats.recentLedger ?? []).map((row, index) => (
                  <div
                    key={`${row.created_at}-${index}`}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-white/65 px-4 py-3 text-sm ring-1 ring-black/[0.04]"
                  >
                    <span className="font-semibold">
                      {row.event_type}
                      {row.feature ? ` · ${row.feature}` : ""}
                    </span>
                    <span className="text-right text-xs text-[#6e6e73]">
                      {row.amount > 0 ? "+" : ""}
                      {n(row.amount)}
                      <br />
                      {dt(row.created_at)}
                    </span>
                  </div>
                ))}
                {!stats.recentLedger?.length ? (
                  <Empty>イベントはありません。</Empty>
                ) : null}
              </div>
            </div>
          </section>

          <p className="px-1 text-xs font-medium leading-5 text-[#6e6e73]">
            管理者は変更されにくいSupabase Auth
            UUID（ADMIN_USER_IDS）で指定します。匿名IDを環境間で安定させるにはADMIN_AUDIT_HMAC_SECRETを設定してください。管理者以外には管理画面・APIとも404を返します。
          </p>
        </div>
      ) : null}
    </div>
  );
}
