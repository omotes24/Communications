"use client";

import { useState } from "react";

const collapsedLimit = 10;
const japanTimeZone = "Asia/Tokyo";

type UsageEvent = {
  created_at: string;
  feature: string;
  model: string;
  calculated_app_tokens: number;
  status: string;
};

type LedgerEvent = {
  created_at: string;
  event_type: string;
  amount: number;
  feature: string | null;
};

type TokenActivitySectionsProps = {
  usage: UsageEvent[];
  ledger: LedgerEvent[];
};

export function TokenActivitySections({
  usage,
  ledger,
}: TokenActivitySectionsProps) {
  const [showAllUsage, setShowAllUsage] = useState(false);
  const [showAllLedger, setShowAllLedger] = useState(false);
  const visibleUsage = showAllUsage ? usage : usage.slice(0, collapsedLimit);
  const visibleLedger = showAllLedger ? ledger : ledger.slice(0, collapsedLimit);

  return (
    <>
      <section className="mt-6 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            直近のAI利用
          </h2>
          {usage.length > collapsedLimit ? (
            <button
              type="button"
              onClick={() => setShowAllUsage((current) => !current)}
              className="inline-flex h-9 items-center rounded-full bg-[#f5f5f7] px-4 text-xs font-semibold text-[#1d1d1f] transition hover:bg-[#e8e8ed]"
            >
              {showAllUsage ? "折りたたむ" : "全体表示"}
            </button>
          ) : null}
        </div>
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
              {visibleUsage.map((event) => (
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            直近のトークン増減
          </h2>
          {ledger.length > collapsedLimit ? (
            <button
              type="button"
              onClick={() => setShowAllLedger((current) => !current)}
              className="inline-flex h-9 items-center rounded-full bg-[#f5f5f7] px-4 text-xs font-semibold text-[#1d1d1f] transition hover:bg-[#e8e8ed]"
            >
              {showAllLedger ? "折りたたむ" : "全体表示"}
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-2">
          {visibleLedger.map((event) => (
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
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: japanTimeZone,
  }).format(new Date(value));
}
