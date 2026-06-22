"use client";

import { Trash2 } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStorage } from "@/lib/storage/use-app-storage";

export function HistoryScreen() {
  const { storage, actions } = useAppStorage();

  return (
    <section>
      <PageHeader
        title="セッション履歴"
        description="履歴は標準では保存されません。回答画面で明示的に保存したセッションだけが表示されます。"
      />
      <div className="grid gap-3">
        {storage.history.length === 0 ? (
          <div className="rounded-[30px] bg-white p-6 text-sm font-medium text-[#6e6e73] shadow-sm ring-1 ring-black/[0.06]">
            保存済み履歴はありません。
          </div>
        ) : (
          storage.history.map((record) => (
            <article
              key={record.id}
              className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-[#f5f5f7] px-3 py-1.5 text-xs font-semibold text-[#6e6e73]">
                    面接
                  </span>
                  <h2 className="mt-4 text-base font-semibold">
                    {record.question}
                  </h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-7 text-[#424245]">
                    {record.answer}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => actions.deleteSession(record.id)}
                  className="rounded-full p-2 text-red-700 hover:bg-red-50"
                  aria-label="履歴を削除"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
