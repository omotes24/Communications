import Link from "next/link";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireCurrentUser } from "@/lib/auth/server";
import {
  getWalletBalance,
  listLedgerEvents,
  listUsageEvents,
} from "@/lib/tokens/service";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const user = await requireCurrentUser();
  const [wallet, ledger, usage] = await Promise.all([
    getWalletBalance(user.id),
    listLedgerEvents(user.id),
    listUsageEvents(user.id),
  ]);

  return (
    <AppShell>
      <PageHeader
        title="トークン利用"
        description="アプリ内トークンの残高、累計消費、予約中残高、直近の増減を確認できます。"
      />

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
