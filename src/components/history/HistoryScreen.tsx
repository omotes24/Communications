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
          <div className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600">
            保存済み履歴はありません。
          </div>
        ) : (
          storage.history.map((record) => (
            <article
              key={record.id}
              className="rounded-md border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600">
                    {record.mode === "support" ? "同意済み支援" : "面接練習"}
                  </span>
                  <h2 className="mt-3 text-sm font-semibold">
                    {record.question}
                  </h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {record.answer}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => actions.deleteSession(record.id)}
                  className="rounded p-2 text-red-700 hover:bg-red-50"
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
