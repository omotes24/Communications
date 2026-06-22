"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  addSessionRecord,
  clearAppStorage,
  defaultStorage,
  loadAppStorage,
  saveAppStorage,
  upsertCompany,
  upsertProfile,
} from "@/lib/storage/browser-store";
import type {
  AppStorage,
  CompanyProfile,
  SessionRecord,
  UserProfile,
} from "@/lib/schemas/interview";

export function useAppStorage() {
  const [storage, setStorage] = useState<AppStorage>(defaultStorage);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStorage(loadAppStorage());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const commit = useCallback((next: AppStorage) => {
    setStorage(next);
    saveAppStorage(next);
  }, []);

  const actions = useMemo(
    () => ({
      saveProfile(profile: UserProfile) {
        commit(upsertProfile(storage, profile));
      },
      deleteProfile(id: string) {
        commit({
          ...storage,
          profiles: storage.profiles.filter((item) => item.id !== id),
        });
      },
      saveCompany(company: CompanyProfile) {
        commit(upsertCompany(storage, company));
      },
      deleteCompany(id: string) {
        commit({
          ...storage,
          companies: storage.companies.filter((item) => item.id !== id),
        });
      },
      saveSession(record: SessionRecord) {
        commit(addSessionRecord(storage, record));
      },
      deleteSession(id: string) {
        commit({
          ...storage,
          history: storage.history.filter((item) => item.id !== id),
        });
      },
      setSaveHistoryByDefault(saveHistoryByDefault: boolean) {
        commit({
          ...storage,
          privacy: { ...storage.privacy, saveHistoryByDefault },
        });
      },
      clearAll() {
        clearAppStorage();
        setStorage(defaultStorage);
      },
    }),
    [commit, storage],
  );

  return { ready, storage, actions };
}
