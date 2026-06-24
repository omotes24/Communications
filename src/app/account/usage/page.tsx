import Link from "next/link";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireCurrentUser } from "@/lib/auth/server";
import { settleCheckoutSessionForUser } from "@/lib/billing/grants";
import {
  getWalletBalance,
  listLedgerEvents,
  listUsageEvents,
} from "@/lib/tokens/service";

export const dynamic = "force-dynamic";

type UsagePageSearchParams = Promise<{
  checkout?: string | string[];
  session_id?: string | string[];
}>;

type CheckoutNotice = {
  tone: "success" | "warning";
  message: string;
};

export default async function UsagePage({
  searchParams,
}: {
  searchParams?: UsagePageSearchParams;
}) {
  const user = await requireCurrentUser();
  const params = searchParams ? await searchParams : {};
  const checkoutNotice = await settleCheckoutReturn(params, user.id);
  const [wallet, ledger, usage] = await Promise.all([
    getWalletBalance(user.id),
    listLedgerEvents(user.id),
    listUsageEvents(user.id, 120),
  ]);
  const dailyUsage = buildDailyUsageChart(usage, 14);
  const recentUsageTotal = dailyUsage.reduce((sum, item) => sum + item.total, 0);
  const maxDailyUsage = Math.max(...dailyUsage.map((item) => item.total), 1);

  return (
    <AppShell>
      <PageHeader
        title="トークン利用"
        description="アプリ内トークンの残高、累計消費、予約中残高、直近の増減を確認できます。"
      />

      {checkoutNotice ? (
        <div
          className={
            checkoutNotice.tone === "success"
              ? "mb-5 rounded-[22px] bg-[var(--accent-soft)] px-5 py-4 text-sm font-semibold leading-6 text-[var(--accent)]"
              : "mb-5 rounded-[22px] bg-amber-50 px-5 py-4 text-sm font-semibold leading-6 text-amber-800"
          }
        >
          {checkoutNotice.message}
        </div>
      ) : null}

      <section className="grid gap-5 md:grid-cols-4">
        <div className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
          <p className="text-xs font-semibold text-[#6e6e73]">利用可能残高</p>
          <p className="mt-3 text-3xl font-semibold">
            {wallet.available_balance.toLocaleString()}
          </p>
        </div>
        <div className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
          <p className="text-xs font-semibold text-[#6e6e73]">累計消費</p>
          <p className="mt-3 text-3xl font-semibold">
            {wallet.lifetime_consumed.toLocaleString()}
          </p>
        </div>
        <div className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
          <p className="text-xs font-semibold text-[#6e6e73]">予約中残高</p>
          <p className="mt-3 text-3xl font-semibold">
            {wallet.reserved_balance.toLocaleString()}
          </p>
        </div>
        <div className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
          <p className="text-xs font-semibold text-[#6e6e73]">購入</p>
          <Link
            href="/pricing"
            className="mt-3 inline-flex h-10 items-center rounded-full bg-[#1d1d1f] px-4 text-sm font-semibold text-white"
          >
            トークンを追加
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              日別トークン消費
            </h2>
            <p className="mt-2 text-sm font-medium text-[#6e6e73]">
              直近14日間のAI利用で消費したapp tokensです。
            </p>
          </div>
          <div className="rounded-2xl bg-[#f5f5f7] px-4 py-3 text-right">
            <p className="text-xs font-semibold text-[#6e6e73]">直近14日</p>
            <p className="mt-1 text-2xl font-semibold">
              {recentUsageTotal.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto pb-2">
          <div className="grid min-w-[720px] grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-2">
            {dailyUsage.map((day) => {
              const barHeight =
                day.total > 0
                  ? `${Math.max((day.total / maxDailyUsage) * 100, 6)}%`
                  : "2px";

              return (
                <div key={day.key} className="grid gap-2">
                  <div className="flex h-44 items-end rounded-2xl bg-[#f5f5f7] px-2 py-2">
                    <div
                      className={
                        day.total > 0
                          ? "w-full rounded-t-xl bg-[var(--accent)]"
                          : "w-full rounded-full bg-black/10"
                      }
                      style={{ height: barHeight }}
                      title={`${day.label}: ${day.total.toLocaleString()} tokens`}
                    />
                  </div>
                  <div className="grid gap-1 text-center">
                    <span className="text-[11px] font-semibold text-[#6e6e73]">
                      {day.label}
                    </span>
                    <span className="text-xs font-semibold text-[#1d1d1f]">
                      {day.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06]">
        <h2 className="text-xl font-semibold tracking-tight">直近のAI利用</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-xs font-semibold text-[#6e6e73]">
              <tr>
                <th className="py-3">日付</th>
                <th className="py-3">機能</th>
                <th className="py-3">モデル</th>
                <th className="py-3">消費</th>
                <th className="py-3">結果</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {usage.map((event) => (
                <tr key={`${event.created_at}-${event.feature}`}>
                  <td className="py-3">{formatDate(event.created_at)}</td>
                  <td className="py-3">{event.feature}</td>
                  <td className="py-3">{event.model}</td>
                  <td className="py-3">
                    {Number(event.calculated_app_tokens).toLocaleString()}
                  </td>
                  <td className="py-3">{event.status}</td>
                </tr>
              ))}
              {usage.length === 0 ? (
                <tr>
                  <td className="py-6 text-[#6e6e73]" colSpan={5}>
                    まだ利用履歴はありません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06]">
        <h2 className="text-xl font-semibold tracking-tight">
          直近のトークン増減
        </h2>
        <div className="mt-4 grid gap-2">
          {ledger.map((event) => (
            <div
              key={`${event.created_at}-${event.event_type}-${event.amount}`}
              className="grid gap-2 rounded-2xl bg-[#f5f5f7] p-4 text-sm font-semibold sm:grid-cols-[160px_1fr_120px]"
            >
              <span>{formatDate(event.created_at)}</span>
              <span>{event.feature ?? event.event_type}</span>
              <span>{Number(event.amount).toLocaleString()}</span>
            </div>
          ))}
          {ledger.length === 0 ? (
            <p className="text-sm font-medium text-[#6e6e73]">
              まだトークン増減はありません。
            </p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}

async function settleCheckoutReturn(
  params: Awaited<UsagePageSearchParams>,
  userId: string,
): Promise<CheckoutNotice | null> {
  if (firstParam(params.checkout) !== "success") {
    return null;
  }

  const sessionId = firstParam(params.session_id);
  if (!sessionId) {
    return {
      tone: "warning",
      message:
        "支払い完了情報を確認できませんでした。残高が増えない場合は問い合わせから連絡してください。",
    };
  }

  try {
    const result = await settleCheckoutSessionForUser(sessionId, userId);
    if (result === "settled") {
      return {
        tone: "success",
        message: "支払いを確認しました。購入トークンを残高へ反映しました。",
      };
    }
    return {
      tone: "warning",
      message:
        "支払い処理がまだ完了していません。Stripe側で完了すると残高へ反映されます。",
    };
  } catch {
    return {
      tone: "warning",
      message:
        "支払い確認を完了できませんでした。残高が増えない場合は問い合わせから連絡してください。",
    };
  }
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildDailyUsageChart(
  usageEvents: Awaited<ReturnType<typeof listUsageEvents>>,
  days: number,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows = Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));
    return {
      key: formatDateKey(date),
      label: new Intl.DateTimeFormat("ja-JP", {
        month: "numeric",
        day: "numeric",
      }).format(date),
      total: 0,
    };
  });
  const rowByKey = new Map(rows.map((row) => [row.key, row]));

  for (const event of usageEvents) {
    const row = rowByKey.get(formatDateKey(new Date(event.created_at)));
    if (row) {
      row.total += Number(event.calculated_app_tokens) || 0;
    }
  }

  return rows;
}

function formatDateKey(value: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
