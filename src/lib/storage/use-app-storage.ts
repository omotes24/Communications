"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addSessionRecord,
  APP_STORAGE_EVENT,
  clearAppStorage,
  defaultStorage,
  deleteGroupDiscussionSession,
  getActiveCompany,
  getActiveCompanies,
  getActiveProfile,
  getActiveProfiles,
  LOCAL_STORAGE_IMPORT_STATUS_KEY,
  saveAppStorage,
  saveLearning,
  setActiveCompany,
  setActiveProfile,
  setSelectedCompanies,
  setSelectedProfiles,
  toggleSelectedCompany,
  toggleSelectedProfile,
  upsertGroupDiscussionSession,
  upsertCompany,
  upsertProfile,
} from "@/lib/storage/browser-store";
import type { GroupDiscussionSessionRecord } from "@/lib/schemas/groupDiscussion";
import type {
  AppStorage,
  CompanyProfile,
  PreInterviewLearning,
  SessionRecord,
  UserProfile,
} from "@/lib/schemas/interview";

const ACTIVE_COMPANY_SESSION_KEY =
  "jp-interview-assistant:active-company-id:v1";

function readPreferredActiveCompanyId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage.getItem(ACTIVE_COMPANY_SESSION_KEY);
}

function writePreferredActiveCompanyId(id: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  if (id) {
    window.sessionStorage.setItem(ACTIVE_COMPANY_SESSION_KEY, id);
    return;
  }
  window.sessionStorage.removeItem(ACTIVE_COMPANY_SESSION_KEY);
}

function preferSessionActiveCompany(storage: AppStorage): AppStorage {
  const preferredCompanyId = readPreferredActiveCompanyId();
  if (!preferredCompanyId) {
    return storage;
  }
  if (storage.companies.some((company) => company.id === preferredCompanyId)) {
    return setActiveCompany(storage, preferredCompanyId);
  }
  writePreferredActiveCompanyId(null);
  return storage;
}

export function useAppStorage() {
  const [storage, setStorage] = useState<AppStorage>(defaultStorage);
  const [ready, setReady] = useState(false);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const storageRef = useRef<AppStorage>(defaultStorage);
  const pendingCloudSaveRef = useRef(false);
  const initialCloudLoadCompletedRef = useRef(false);

  const applyStorage = useCallback((next: AppStorage) => {
    storageRef.current = next;
    setStorage(next);
  }, []);

  const persistCloudStorage = useCallback((next: AppStorage) => {
    void fetch("/api/storage", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCloudStorage() {
      try {
        const response = await fetch("/api/storage", {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          if (!pendingCloudSaveRef.current) {
            applyStorage(defaultStorage);
          }
          setCloudSyncEnabled(false);
          return;
        }
        const data = (await response.json()) as {
          storage: AppStorage;
        };
        if (cancelled) {
          return;
        }
        if (pendingCloudSaveRef.current) {
          pendingCloudSaveRef.current = false;
          setCloudSyncEnabled(true);
          persistCloudStorage(storageRef.current);
          return;
        }
        applyStorage(preferSessionActiveCompany(data.storage));
        setCloudSyncEnabled(true);
      } catch {
        if (!cancelled) {
          if (!pendingCloudSaveRef.current) {
            applyStorage(defaultStorage);
          }
          setCloudSyncEnabled(false);
        }
      } finally {
        if (!cancelled) {
          initialCloudLoadCompletedRef.current = true;
          setReady(true);
        }
      }
    }

    void loadCloudStorage();
    window.addEventListener(APP_STORAGE_EVENT, loadCloudStorage);

    return () => {
      cancelled = true;
      window.removeEventListener(APP_STORAGE_EVENT, loadCloudStorage);
    };
  }, [applyStorage, persistCloudStorage]);

  const commit = useCallback(
    (buildNext: (current: AppStorage) => AppStorage) => {
      const next = buildNext(storageRef.current);
      writePreferredActiveCompanyId(next.activeCompanyId);
      applyStorage(next);
      if (cloudSyncEnabled) {
        persistCloudStorage(next);
      } else {
        saveAppStorage(next);
        pendingCloudSaveRef.current = !initialCloudLoadCompletedRef.current;
      }
    },
    [applyStorage, cloudSyncEnabled, persistCloudStorage],
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
      saveGroupDiscussionSession(session: GroupDiscussionSessionRecord) {
        commit((current) => upsertGroupDiscussionSession(current, session));
      },
      deleteGroupDiscussionSession(id: string) {
        commit((current) => deleteGroupDiscussionSession(current, id));
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
        writePreferredActiveCompanyId(null);
        window.localStorage.setItem(
          LOCAL_STORAGE_IMPORT_STATUS_KEY,
          "declined",
        );
        applyStorage(defaultStorage);
        pendingCloudSaveRef.current = false;
        if (cloudSyncEnabled) {
          void fetch("/api/storage", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              storage: defaultStorage,
              allowEmptyOverwrite: true,
            }),
          });
        }
      },
    }),
    [applyStorage, cloudSyncEnabled, commit],
  );

  return {
    ready,
    storage,
    cloudSyncEnabled,
    activeCompany: getActiveCompany(storage),
    activeCompanies: getActiveCompanies(storage),
    activeProfile: getActiveProfile(storage),
    activeProfiles: getActiveProfiles(storage),
    actions,
  };
}
