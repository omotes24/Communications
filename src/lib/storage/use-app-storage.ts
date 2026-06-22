"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  addSessionRecord,
  APP_STORAGE_EVENT,
  clearAppStorage,
  defaultStorage,
  loadAppStorage,
  saveAppStorage,
  saveLearning,
  upsertCompany,
  upsertProfile,
} from "@/lib/storage/browser-store";
import type {
  AppStorage,
  CompanyProfile,
  PreInterviewLearning,
  SessionRecord,
  UserProfile,
} from "@/lib/schemas/interview";

export function useAppStorage() {
  const [storage, setStorage] = useState<AppStorage>(defaultStorage);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loadLatestStorage = () => {
      setStorage(loadAppStorage());
      setReady(true);
    };
    const timer = window.setTimeout(() => {
      loadLatestStorage();
    }, 0);

    const handleBrowserStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "jp-interview-assistant:v1") {
        loadLatestStorage();
      }
    };

    window.addEventListener(APP_STORAGE_EVENT, loadLatestStorage);
    window.addEventListener("storage", handleBrowserStorage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(APP_STORAGE_EVENT, loadLatestStorage);
      window.removeEventListener("storage", handleBrowserStorage);
    };
  }, []);

  const commit = useCallback(
    (buildNext: (current: AppStorage) => AppStorage) => {
      const next = buildNext(loadAppStorage());
      setStorage(next);
      saveAppStorage(next);
    },
    [],
  );

  const actions = useMemo(
    () => ({
      saveProfile(profile: UserProfile) {
        commit((current) => upsertProfile(current, profile));
      },
      deleteProfile(id: string) {
        commit((current) => ({
          ...current,
          profiles: current.profiles.filter((item) => item.id !== id),
        }));
      },
      saveCompany(company: CompanyProfile) {
        commit((current) => upsertCompany(current, company));
      },
      deleteCompany(id: string) {
        commit((current) => ({
          ...current,
          companies: current.companies.filter((item) => item.id !== id),
        }));
      },
      saveSession(record: SessionRecord) {
        commit((current) => addSessionRecord(current, record));
      },
      saveLearning(learning: PreInterviewLearning) {
        commit((current) => saveLearning(current, learning));
      },
      clearLearning() {
        commit((current) => ({ ...current, learning: null }));
      },
      deleteSession(id: string) {
        commit((current) => ({
          ...current,
          history: current.history.filter((item) => item.id !== id),
        }));
      },
      setSaveHistoryByDefault(saveHistoryByDefault: boolean) {
        commit((current) => ({
          ...current,
          privacy: { ...current.privacy, saveHistoryByDefault },
        }));
      },
      clearAll() {
        clearAppStorage();
        setStorage(defaultStorage);
      },
    }),
    [commit],
  );

  return { ready, storage, actions };
}
