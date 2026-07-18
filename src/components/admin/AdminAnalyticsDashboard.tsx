"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  Clock3,
  Eye,
  Laptop,
  Loader2,
  MonitorSmartphone,
  MousePointerClick,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tablet,
} from "lucide-react";

import { AdminSectionNav } from "@/components/admin/AdminSectionNav";

const REFRESH_INTERVAL_MS = 60_000;
const ranges = [7, 30, 90] as const;

type DailyRow = {
  day: string;
  pageViews: number;
  sessions: number;
};

type PageRow = {
  pathGroup: string;
  pageViews: number;
  sessions: number;
};

type DeviceRow = {
  deviceCategory: "mobile" | "tablet" | "desktop" | "unknown";
  pageViews: number;
  sessions: number;
};

type AnalyticsStats = {
  configured: boolean;
  collectionEnabled: boolean;
  generatedAt: string;
  rangeDays: number;
  retentionDays: number;
  timezone: string;
  startsAt?: string;
  endsAt?: string;
  pageViews?: number;
  sessions?: number;
  pagesPerSession?: number;
  singlePageRate?: number;
  todayPageViews?: number;
  todaySessions?: number;
  collectedSince?: string | null;
  lastReceivedAt?: string | null;
  daily?: DailyRow[];
  topPages?: PageRow[];
  devices?: DeviceRow[];
  recent?: {
    pathGroup: string;
    deviceCategory: DeviceRow["deviceCategory"];
    createdAt: string;
  }[];
};

const deviceLabels: Record<DeviceRow["deviceCategory"], string> = {
  mobile: "モバイル",
  tablet: "タブレット",
  desktop: "デスクトップ",
  unknown: "不明",
};

const deviceIcons = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Laptop,
  unknown: MonitorSmartphone,
} satisfies Record<DeviceRow["deviceCategory"], typeof Smartphone>;

function number(value: number | undefined, digits = 0): string {
  return (value ?? 0).toLocaleString("ja-JP", {
    maximumFractionDigits: digits,
  });
}

function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortDay(value: string): string {
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="jt-card overflow-hidden p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold tracking-[0.14em] text-[var(--muted)]">
          {label}
        </p>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
          <Icon className="h-4.5 w-4.5" aria-hidden />
        </span>
      </div>
      <p className="mt-4 text-3xl font-extrabold tracking-[-0.04em] text-[var(--foreground)]">
        {value}
      </p>
      <p className="mt-2 text-xs font-medium leading-5 text-[var(--muted)]">
        {detail}
      </p>
    </article>
  );
}

function DailyChart({ rows }: { rows: DailyRow[] }) {
  const width = 760;
  const height = 250;
  const left = 34;
  const right = 16;
  const top = 18;
  const bottom = 40;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxPageViews = Math.max(1, ...rows.map((row) => row.pageViews));
  const maxSessions = Math.max(1, ...rows.map((row) => row.sessions));
  const step = rows.length ? chartWidth / rows.length : chartWidth;
  const barWidth = Math.max(4, Math.min(18, step * 0.58));
  const labelEvery = Math.max(1, Math.ceil(rows.length / 7));
  const sessionPoints = rows
    .map((row, index) => {
      const x = left + step * index + step / 2;
      const y = top + chartHeight - (row.sessions / maxSessions) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  if (!rows.length) {
    return (
      <p className="grid min-h-56 place-items-center text-sm text-[var(--muted)]">
        まだ日別データはありません。
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-[var(--muted)]">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--accent-soft)] ring-1 ring-[var(--accent-ring)]" />
          ページビュー
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-5 bg-[var(--accent)]" />
          セッション
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="日別のページビューとセッション推移"
          className="h-auto min-w-[620px] w-full"
        >
          {[0, 0.5, 1].map((ratio) => {
            const y = top + chartHeight * ratio;
            return (
              <line
                key={ratio}
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="4 5"
              />
            );
          })}
          {rows.map((row, index) => {
            const x = left + step * index + step / 2;
            const barHeight = (row.pageViews / maxPageViews) * chartHeight;
            return (
              <g key={row.day}>
                <rect
                  x={x - barWidth / 2}
                  y={top + chartHeight - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx={barWidth / 3}
                  fill="var(--accent-soft)"
                  stroke="var(--accent-ring)"
                  strokeWidth="0.8"
                >
                  <title>{`${shortDay(row.day)}: ${number(row.pageViews)} PV / ${number(row.sessions)} セッション`}</title>
                </rect>
                {index % labelEvery === 0 || index === rows.length - 1 ? (
                  <text
                    x={x}
                    y={height - 14}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--muted)"
                  >
                    {shortDay(row.day)}
                  </text>
                ) : null}
              </g>
            );
          })}
          <polyline
            points={sessionPoints}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {rows.map((row, index) => {
            const x = left + step * index + step / 2;
            const y =
              top + chartHeight - (row.sessions / maxSessions) * chartHeight;
            return (
              <circle
                key={`${row.day}-session`}
                cx={x}
                cy={y}
                r="2.6"
                fill="var(--accent)"
              />
            );
          })}
        </svg>
      </div>
      <table className="sr-only">
        <caption>日別アクセス数</caption>
        <thead>
          <tr>
            <th>日付</th>
            <th>ページビュー</th>
            <th>セッション</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.day}-accessible`}>
              <td>{row.day}</td>
              <td>{row.pageViews}</td>
              <td>{row.sessions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminAnalyticsDashboard() {
  const [days, setDays] = useState<(typeof ranges)[number]>(30);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/analytics?days=${days}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as AnalyticsStats & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "アクセス解析を取得できませんでした。");
      }
      setStats(data);
      setError(null);
    } catch (cause) {
      setStats(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "アクセス解析を取得できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    const clearSensitiveState = () => setStats(null);
    const refreshAfterRestore = () => {
      setStats(null);
      setLoading(true);
      void load();
    };
    window.addEventListener("pagehide", clearSensitiveState);
    window.addEventListener("pageshow", refreshAfterRestore);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("pagehide", clearSensitiveState);
      window.removeEventListener("pageshow", refreshAfterRestore);
    };
  }, [load]);

  const maxDeviceViews = useMemo(
    () => Math.max(1, ...(stats?.devices ?? []).map((row) => row.pageViews)),
    [stats?.devices],
  );

  return (
    <div className="pb-10 text-[var(--foreground)]">
      <header className="mb-4">
        <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.35px] text-[var(--accent-text)]">
          Yell for You 1.3
        </p>
        <h1 className="text-[28px] font-extrabold leading-8 tracking-[-1.05px] text-[var(--foreground)]">
          Webアクセス分析
        </h1>
        <p className="mt-1.5 max-w-[760px] text-sm leading-6 text-[var(--muted)]">
          サイトのページビュー、匿名セッション、閲覧ページを集計します。IPアドレスやUser-Agent、氏名、メールは保存しません。
        </p>
      </header>

      <AdminSectionNav active="analytics" />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1"
          aria-label="集計期間"
        >
          {ranges.map((range) => (
            <button
              key={range}
              type="button"
              aria-pressed={days === range}
              onClick={() => {
                setLoading(true);
                setDays(range);
              }}
              className={`min-h-10 rounded-lg px-3.5 text-sm font-semibold transition ${
                days === range
                  ? "bg-[var(--accent)] text-[var(--accent-on)] shadow-sm"
                  : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {range}日
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] shadow-sm transition hover:bg-[var(--surface-muted)] disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden />
          )}
          更新
        </button>
        {stats ? (
          <span className="text-xs font-medium text-[var(--muted)]">
            最終更新 {dateTime(stats.generatedAt)}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)] ring-1 ring-[var(--accent-ring)]/30">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          管理者限定・匿名集計
        </span>
      </div>

      {error ? (
        <p className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-[var(--foreground)]">
          {error}
        </p>
      ) : null}

      {stats && !stats.collectionEnabled ? (
        <div className="mb-5 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm font-semibold leading-6 text-[var(--foreground)]">
          アクセス収集は現在停止中です。Productionの
          NEXT_PUBLIC_PRODUCT_ANALYTICS_ENABLEDをtrueにして再デプロイすると記録を開始します。
        </div>
      ) : null}

      {stats && !stats.configured ? (
        <div className="jt-card p-6 text-sm font-semibold leading-6 text-[var(--foreground)]">
          Supabase Service Roleが未設定のため、アクセス解析を表示できません。
        </div>
      ) : null}

      {stats?.configured ? (
        <div className="grid gap-5">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={CalendarDays}
              label="今日のページビュー"
              value={number(stats.todayPageViews)}
              detail={`今日の匿名セッション ${number(stats.todaySessions)}`}
            />
            <Metric
              icon={Eye}
              label={`${stats.rangeDays}日間のページビュー`}
              value={number(stats.pageViews)}
              detail={`収集対象ページの表示回数`}
            />
            <Metric
              icon={Activity}
              label="匿名セッション"
              value={number(stats.sessions)}
              detail={`タブを開いてから閉じるまでを1セッションとして集計`}
            />
            <Metric
              icon={MousePointerClick}
              label="1セッションあたりPV"
              value={number(stats.pagesPerSession, 2)}
              detail={`単一ページセッション率 ${number(stats.singlePageRate, 1)}%`}
            />
          </section>

          <section className="jt-card p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-[var(--accent-text)]">
                  TRAFFIC TREND
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight">
                  日別アクセス推移
                </h2>
              </div>
              <p className="text-xs font-medium text-[var(--muted)]">
                JST・過去{stats.rangeDays}日
              </p>
            </div>
            <DailyChart rows={stats.daily ?? []} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
            <div className="jt-card overflow-hidden">
              <div className="border-b border-[var(--border)] p-5 sm:p-6">
                <h2 className="text-lg font-bold">よく見られているページ</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  クエリ文字列や入力内容は含めず、ページグループだけを表示します。
                </p>
              </div>
              {(stats.topPages ?? []).length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-[var(--surface-muted)] text-xs text-[var(--muted)]">
                      <tr>
                        <th className="px-5 py-3 font-semibold">ページ</th>
                        <th className="px-4 py-3 text-right font-semibold">
                          PV
                        </th>
                        <th className="px-4 py-3 text-right font-semibold">
                          セッション
                        </th>
                        <th className="px-5 py-3 text-right font-semibold">
                          構成比
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {(stats.topPages ?? []).map((row) => (
                        <tr key={row.pathGroup}>
                          <td className="max-w-[360px] truncate px-5 py-3.5 font-semibold">
                            {row.pathGroup}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums">
                            {number(row.pageViews)}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums">
                            {number(row.sessions)}
                          </td>
                          <td className="px-5 py-3.5 text-right tabular-nums text-[var(--muted)]">
                            {stats.pageViews
                              ? number(
                                  (row.pageViews / stats.pageViews) * 100,
                                  1,
                                )
                              : "0"}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-8 text-center text-sm text-[var(--muted)]">
                  収集開始後、ページ別データがここに表示されます。
                </p>
              )}
            </div>

            <div className="jt-card p-5 sm:p-6">
              <h2 className="text-lg font-bold">デバイス区分</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                User-Agentではなく、表示幅だけで分類します。
              </p>
              <div className="mt-5 grid gap-4">
                {(stats.devices ?? []).map((row) => {
                  const Icon = deviceIcons[row.deviceCategory];
                  return (
                    <div key={row.deviceCategory}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="inline-flex items-center gap-2 font-semibold">
                          <Icon
                            className="h-4 w-4 text-[var(--accent-text)]"
                            aria-hidden
                          />
                          {deviceLabels[row.deviceCategory]}
                        </span>
                        <span className="tabular-nums text-[var(--muted)]">
                          {number(row.pageViews)} PV
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{
                            width: `${Math.max(3, (row.pageViews / maxDeviceViews) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {!stats.devices?.length ? (
                  <p className="py-6 text-center text-sm text-[var(--muted)]">
                    まだデータはありません。
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="jt-card p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <Clock3
                  className="h-5 w-5 text-[var(--accent-text)]"
                  aria-hidden
                />
                <h2 className="text-lg font-bold">収集状態</h2>
              </div>
              <dl className="mt-5 grid gap-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-[var(--border)] pb-3">
                  <dt className="text-[var(--muted)]">収集</dt>
                  <dd className="font-semibold">
                    {stats.collectionEnabled ? "有効" : "停止中"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-[var(--border)] pb-3">
                  <dt className="text-[var(--muted)]">収集開始</dt>
                  <dd className="text-right font-semibold">
                    {dateTime(stats.collectedSince)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-[var(--border)] pb-3">
                  <dt className="text-[var(--muted)]">最終受信</dt>
                  <dd className="text-right font-semibold">
                    {dateTime(stats.lastReceivedAt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">生データ保持</dt>
                  <dd className="font-semibold">{stats.retentionDays}日</dd>
                </div>
              </dl>
            </div>

            <div className="jt-card p-5 sm:p-6">
              <h2 className="text-lg font-bold">最近のページビュー</h2>
              <div className="mt-4 grid gap-2">
                {(stats.recent ?? []).map((row, index) => {
                  const Icon = deviceIcons[row.deviceCategory];
                  return (
                    <div
                      key={`${row.createdAt}-${row.pathGroup}-${index}`}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-3 text-sm"
                    >
                      <span className="min-w-0 truncate font-semibold">
                        {row.pathGroup}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--muted)]">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {dateTime(row.createdAt)}
                      </span>
                    </div>
                  );
                })}
                {!stats.recent?.length ? (
                  <p className="py-6 text-center text-sm text-[var(--muted)]">
                    まだページビューはありません。
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <p className="px-1 text-xs font-medium leading-5 text-[var(--muted)]">
            JavaScriptが有効で、アクセス解析を無効化していないブラウザだけを計測します。過去のアクセスは遡って復元できず、収集開始後から表示されます。管理画面とAPIへのアクセスは集計しません。
          </p>
        </div>
      ) : null}
    </div>
  );
}
