import Link from "next/link";

import { TokenActivitySections } from "@/components/account/TokenActivitySections";
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

const japanTimeZone = "Asia/Tokyo";

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

      <TokenActivitySections usage={usage} ledger={ledger} />
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

function buildDailyUsageChart(
  usageEvents: Awaited<ReturnType<typeof listUsageEvents>>,
  days: number,
) {
  const todayKey = formatDateKey(new Date());
  const rows = Array.from({ length: days }, (_, index) => {
    const key = addDaysToDateKey(todayKey, -(days - 1 - index));
    return {
      key,
      label: new Intl.DateTimeFormat("ja-JP", {
        month: "numeric",
        day: "numeric",
        timeZone: japanTimeZone,
      }).format(dateFromTokyoDateKey(key)),
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
    timeZone: japanTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function dateFromTokyoDateKey(key: string): Date {
  return new Date(`${key}T03:00:00.000Z`);
}

function addDaysToDateKey(key: string, days: number): string {
  const date = dateFromTokyoDateKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateKey(date);
}
