"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  addSessionRecord,
  APP_STORAGE_EVENT,
  clearAppStorage,
  defaultStorage,
  getActiveCompany,
  getActiveCompanies,
  getActiveProfile,
  getActiveProfiles,
  hasMeaningfulLocalStorage,
  loadAppStorage,
  LOCAL_STORAGE_IMPORT_STATUS_KEY,
  saveAppStorage,
  saveLearning,
  setActiveCompany,
  setActiveProfile,
  setSelectedCompanies,
  setSelectedProfiles,
  toggleSelectedCompany,
  toggleSelectedProfile,
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
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    async function loadCloudStorage() {
      try {
        const response = await fetch("/api/storage", {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as {
          storage: AppStorage;
          hasCloudData: boolean;
          importedLocalStorage: boolean;
        };
        if (cancelled) {
          return;
        }

        const local = loadAppStorage();
        const importStatus = window.localStorage.getItem(
          LOCAL_STORAGE_IMPORT_STATUS_KEY,
        );
        const localHasData = hasMeaningfulLocalStorage(local);
        const canUseCloud =
          data.hasCloudData ||
          data.importedLocalStorage ||
          importStatus === "accepted" ||
          importStatus === "declined" ||
          !localHasData;

        if (canUseCloud) {
          setStorage(data.storage);
          saveAppStorage(data.storage);
          setCloudSyncEnabled(true);
        } else {
          setCloudSyncEnabled(false);
        }
      } catch {
        setCloudSyncEnabled(false);
      }
    }

    if (ready) {
      void loadCloudStorage();
    }

    return () => {
      cancelled = true;
    };
  }, [ready]);

  const commit = useCallback(
    (buildNext: (current: AppStorage) => AppStorage) => {
      const next = buildNext(loadAppStorage());
      setStorage(next);
      saveAppStorage(next);
      if (cloudSyncEnabled) {
        void fetch("/api/storage", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
      }
    },
    [cloudSyncEnabled],
  );

  const actions = useMemo(
    () => ({
      saveProfile(profile: UserProfile) {
        commit((current) => upsertProfile(current, profile));
      },
      deleteProfile(id: string) {
        commit((current) => {
          const profiles = current.profiles.filter((item) => item.id !== id);
          const selectedProfileIds = current.selectedProfileIds.filter(
            (item) => item !== id,
          );
          const activeProfileId =
            selectedProfileIds[0] ??
            (current.activeProfileId &&
            profiles.some((item) => item.id === current.activeProfileId)
              ? current.activeProfileId
              : profiles[0]?.id) ??
            null;
          return {
            ...current,
            profiles,
            selectedProfileIds:
              selectedProfileIds.length > 0
                ? selectedProfileIds
                : activeProfileId
                  ? [activeProfileId]
                  : [],
            activeProfileId,
          };
        });
      },
      setActiveProfile(id: string | null) {
        commit((current) => setActiveProfile(current, id));
      },
      setSelectedProfiles(ids: string[]) {
        commit((current) => setSelectedProfiles(current, ids));
      },
      toggleSelectedProfile(id: string) {
        commit((current) => toggleSelectedProfile(current, id));
      },
      saveCompany(company: CompanyProfile) {
        commit((current) => upsertCompany(current, company));
      },
      setActiveCompany(id: string | null) {
        commit((current) => setActiveCompany(current, id));
      },
      setSelectedCompanies(ids: string[]) {
        commit((current) => setSelectedCompanies(current, ids));
      },
      toggleSelectedCompany(id: string) {
        commit((current) => toggleSelectedCompany(current, id));
      },
      deleteCompany(id: string) {
        commit((current) => ({
          ...current,
          companies: current.companies.filter((item) => item.id !== id),
          selectedCompanyIds: current.selectedCompanyIds.filter(
            (item) => item !== id,
          ),
          activeCompanyId:
            current.activeCompanyId === id
              ? (current.companies.find((item) => item.id !== id)?.id ?? null)
              : current.activeCompanyId,
          learning:
            current.learning?.companyId === id ? null : current.learning,
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
        window.localStorage.setItem(LOCAL_STORAGE_IMPORT_STATUS_KEY, "declined");
        setCloudSyncEnabled(true);
        setStorage(defaultStorage);
      },
    }),
    [commit],
  );

  return {
    ready,
    storage,
    activeCompany: getActiveCompany(storage),
    activeCompanies: getActiveCompanies(storage),
    activeProfile: getActiveProfile(storage),
    activeProfiles: getActiveProfiles(storage),
    actions,
  };
}
