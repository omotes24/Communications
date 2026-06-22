"use client";

import { ShieldAlert, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStorage } from "@/lib/storage/use-app-storage";

export function PrivacyScreen() {
  const { storage, actions } = useAppStorage();

  return (
    <section>
      <PageHeader
        title="データ削除・プライバシー設定"
        description="ローカルブラウザに保存したプロフィール、企業情報、明示保存した履歴を管理します。"
      />
      <div className="grid gap-4 rounded-md border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            OpenAI API キーはこのブラウザには保存しません。`.env.local`
            のサーバー側環境変数だけで扱います。
          </p>
        </div>
        <label className="flex items-start gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={storage.privacy.saveHistoryByDefault}
            onChange={(event) =>
              actions.setSaveHistoryByDefault(event.target.checked)
            }
            className="mt-1 h-4 w-4"
          />
          <span>履歴保存を標準で有効にする</span>
        </label>
        <div className="grid gap-2 text-sm text-slate-600">
          <p>プロフィール: {storage.profiles.length}件</p>
          <p>企業・求人情報: {storage.companies.length}件</p>
          <p>履歴: {storage.history.length}件</p>
        </div>
        <button
          type="button"
          onClick={actions.clearAll}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-red-700 px-4 text-sm font-medium text-white"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          すべてのデータを削除
        </button>
      </div>
    </section>
  );
}
