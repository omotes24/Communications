"use client";

import { useEffect, useMemo, useState } from "react";

import {
  APP_STORAGE_EVENT,
  clearAppStorage,
  hasMeaningfulLocalStorage,
  loadAppStorage,
  LOCAL_STORAGE_IMPORT_STATUS_KEY,
  LOCAL_STORAGE_IMPORT_VERSION,
} from "@/lib/storage/browser-store";

type MigrationState = "checking" | "hidden" | "prompt" | "working";

export function LocalStorageMigrationPrompt() {
  const [state, setState] = useState<MigrationState>("checking");
  const importId = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    const existing = window.localStorage.getItem(
      `${LOCAL_STORAGE_IMPORT_STATUS_KEY}:import-id`,
    );
    if (existing) {
      return existing;
    }
    const next = crypto.randomUUID();
    window.localStorage.setItem(
      `${LOCAL_STORAGE_IMPORT_STATUS_KEY}:import-id`,
      next,
    );
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const status = window.localStorage.getItem(LOCAL_STORAGE_IMPORT_STATUS_KEY);
      if (status === "accepted" || status === "declined") {
        setState("hidden");
        return;
      }

      const local = loadAppStorage();
      if (!hasMeaningfulLocalStorage(local)) {
        setState("hidden");
        return;
      }

      try {
        const response = await fetch("/api/storage", {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          setState("hidden");
          return;
        }
        const data = (await response.json()) as {
          hasCloudData: boolean;
          importedLocalStorage: boolean;
        };
        if (!cancelled) {
          if (data.hasCloudData || data.importedLocalStorage) {
            window.localStorage.setItem(
              LOCAL_STORAGE_IMPORT_STATUS_KEY,
              "declined",
            );
            clearAppStorage();
            setState("hidden");
            return;
          }
          setState("prompt");
        }
      } catch {
        if (!cancelled) {
          setState("hidden");
        }
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function importLocalData() {
    setState("working");
    const storage = loadAppStorage();
    const response = await fetch("/api/storage/import-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storage,
        importId,
        migrationVersion: LOCAL_STORAGE_IMPORT_VERSION,
      }),
    });
    if (response.ok) {
      window.localStorage.setItem(LOCAL_STORAGE_IMPORT_STATUS_KEY, "accepted");
      clearAppStorage();
      window.dispatchEvent(new Event(APP_STORAGE_EVENT));
    }
    setState("hidden");
  }

  function skipImport() {
    window.localStorage.setItem(LOCAL_STORAGE_IMPORT_STATUS_KEY, "declined");
    clearAppStorage();
    setState("hidden");
  }

  if (state !== "prompt" && state !== "working") {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-[26px] bg-white p-5 shadow-2xl ring-1 ring-black/[0.08]">
      <p className="text-base font-semibold tracking-tight">
        このブラウザに保存されている既存データを、このアカウントに移行しますか？
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-[#6e6e73]">
        同意するまで、既存のlocalStorageデータはサーバーへ送信しません。
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={importLocalData}
          disabled={state === "working"}
          className="h-10 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {state === "working" ? "移行中..." : "移行する"}
        </button>
        <button
          type="button"
          onClick={skipImport}
          disabled={state === "working"}
          className="h-10 rounded-full bg-[#f5f5f7] px-5 text-sm font-semibold text-[#1d1d1f]"
        >
          移行せず削除
        </button>
      </div>
    </div>
  );
}
