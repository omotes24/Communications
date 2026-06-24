"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  clearAppStorage,
  LOCAL_STORAGE_IMPORT_STATUS_KEY,
} from "@/lib/storage/browser-store";

export function DeleteAccountPanel() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function deleteAccount() {
    setError("");
    if (confirmation !== "DELETE") {
      setError("確認欄に DELETE と入力してください。");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "削除に失敗しました。");
      }
      clearAppStorage();
      window.localStorage.removeItem(LOCAL_STORAGE_IMPORT_STATUS_KEY);
      window.localStorage.removeItem(`${LOCAL_STORAGE_IMPORT_STATUS_KEY}:import-id`);
      router.replace("/auth/sign-up");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "削除に失敗しました。",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06]">
      <h2 className="text-2xl font-semibold tracking-tight">アカウント削除</h2>
      <p className="mt-3 text-sm font-medium leading-7 text-[#6e6e73]">
        アカウント、プロフィール、会社情報、面接履歴、利用履歴を削除します。この操作は取り消せません。
      </p>
      <div className="mt-5 grid gap-3">
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="DELETE"
          className="h-12 rounded-2xl border border-red-200 px-4 font-semibold outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
        />
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
        <button
          type="button"
          onClick={deleteAccount}
          disabled={loading}
          className="h-12 rounded-full bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? "削除中..." : "アカウントを完全に削除"}
        </button>
      </div>
    </section>
  );
}
