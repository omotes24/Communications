import {
  appStorageSchema,
  type AppStorage,
  type CompanyProfile,
  type PreInterviewLearning,
  type SessionRecord,
  type UserProfile,
} from "@/lib/schemas/interview";
import type { GroupDiscussionSessionRecord } from "@/lib/schemas/groupDiscussion";

export const STORAGE_KEY = "jp-interview-assistant:v1";
export const COMPANY_FORM_DRAFT_KEY =
  "jp-interview-assistant:company-form-draft:v1";
export const APP_STORAGE_EVENT = "jp-interview-assistant:storage-updated";
export const LOCAL_STORAGE_IMPORT_STATUS_KEY =
  "jp-interview-assistant:local-import-status:v1";
export const LOCAL_STORAGE_IMPORT_VERSION = "app-storage-v1-to-supabase-v1";

export const defaultStorage: AppStorage = {
  profiles: [],
  companies: [],
  activeProfileId: null,
  activeCompanyId: null,
  selectedProfileIds: [],
  selectedCompanyIds: [],
  history: [],
  groupDiscussionSessions: [],
  learning: null,
  privacy: {
    saveHistoryByDefault: false,
  },
};

function normalizeSelectedIds<T extends { id: string }>(
  ids: string[],
  items: T[],
): string[] {
  const validIds = new Set(items.map((item) => item.id));
  return Array.from(new Set(ids)).filter((id) => validIds.has(id));
}

function normalizeStorage(storage: AppStorage): AppStorage {
  const selectedProfileIds = normalizeSelectedIds(
    storage.selectedProfileIds,
    storage.profiles,
  );
  const fallbackProfileId =
    selectedProfileIds[0] ??
    (storage.activeProfileId &&
    storage.profiles.some((profile) => profile.id === storage.activeProfileId)
      ? storage.activeProfileId
      : storage.profiles[0]?.id) ??
    null;
  const normalizedProfileIds =
    selectedProfileIds.length > 0
      ? selectedProfileIds
      : fallbackProfileId
        ? [fallbackProfileId]
        : [];

  const selectedCompanyIds = normalizeSelectedIds(
    storage.selectedCompanyIds,
    storage.companies,
  );
  const validActiveCompanyId =
    storage.activeCompanyId &&
    storage.companies.some((company) => company.id === storage.activeCompanyId)
      ? storage.activeCompanyId
      : null;
  const fallbackCompanyId =
    validActiveCompanyId ??
    selectedCompanyIds[0] ??
    storage.companies[0]?.id ??
    null;
  const normalizedCompanyIds =
    selectedCompanyIds.length > 0
      ? selectedCompanyIds
      : fallbackCompanyId
        ? [fallbackCompanyId]
        : [];
  const companyIdsWithActive =
    validActiveCompanyId &&
    !normalizedCompanyIds.includes(validActiveCompanyId)
      ? [validActiveCompanyId, ...normalizedCompanyIds]
      : normalizedCompanyIds;

  return {
    ...storage,
    selectedProfileIds: normalizedProfileIds,
    activeProfileId: normalizedProfileIds[0] ?? fallbackProfileId,
    selectedCompanyIds: companyIdsWithActive,
    activeCompanyId:
      validActiveCompanyId ?? companyIdsWithActive[0] ?? fallbackCompanyId,
  };
}

export function loadAppStorage(): AppStorage {
  if (typeof window === "undefined") {
    return defaultStorage;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultStorage;
  }
  const parsed: unknown = JSON.parse(raw);
  return normalizeStorage(appStorageSchema.catch(defaultStorage).parse(parsed));
}

export function saveAppStorage(next: AppStorage): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(APP_STORAGE_EVENT));
}

export function clearAppStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(COMPANY_FORM_DRAFT_KEY);
  window.dispatchEvent(new Event(APP_STORAGE_EVENT));
}

export function hasMeaningfulLocalStorage(storage: AppStorage): boolean {
  return (
    storage.profiles.length > 0 ||
    storage.companies.length > 0 ||
    storage.history.length > 0 ||
    storage.groupDiscussionSessions.length > 0 ||
    Boolean(storage.learning)
  );
}

export function upsertProfile(
  storage: AppStorage,
  profile: UserProfile,
): AppStorage {
  const profiles = storage.profiles.some((item) => item.id === profile.id)
    ? storage.profiles.map((item) => (item.id === profile.id ? profile : item))
    : [...storage.profiles, profile];
  const selectedProfileIds = storage.selectedProfileIds.includes(profile.id)
    ? storage.selectedProfileIds
    : [...storage.selectedProfileIds, profile.id];
  return { ...storage, profiles, activeProfileId: profile.id, selectedProfileIds };
}

export function setActiveProfile(
  storage: AppStorage,
  id: string | null,
): AppStorage {
  const activeProfileId =
    id && storage.profiles.some((profile) => profile.id === id) ? id : null;
  if (!activeProfileId) {
    return { ...storage, activeProfileId: null, selectedProfileIds: [] };
  }
  const selectedProfileIds =
    !storage.selectedProfileIds.includes(activeProfileId)
      ? [...storage.selectedProfileIds, activeProfileId]
      : storage.selectedProfileIds;
  return { ...storage, activeProfileId, selectedProfileIds };
}

export function setSelectedProfiles(
  storage: AppStorage,
  ids: string[],
): AppStorage {
  const selectedProfileIds = ids.filter((id) =>
    storage.profiles.some((profile) => profile.id === id),
  );
  return {
    ...storage,
    selectedProfileIds,
    activeProfileId: selectedProfileIds[0] ?? null,
  };
}

export function toggleSelectedProfile(
  storage: AppStorage,
  id: string,
): AppStorage {
  if (!storage.profiles.some((profile) => profile.id === id)) {
    return storage;
  }
  const selectedProfileIds = storage.selectedProfileIds.includes(id)
    ? storage.selectedProfileIds.length > 1
      ? storage.selectedProfileIds.filter((item) => item !== id)
      : storage.selectedProfileIds
    : [...storage.selectedProfileIds, id];
  return {
    ...storage,
    selectedProfileIds,
    activeProfileId: selectedProfileIds[0] ?? null,
  };
}

export function upsertCompany(
  storage: AppStorage,
  company: CompanyProfile,
): AppStorage {
  const exists = storage.companies.some((item) => item.id === company.id);
  const companies = exists
    ? storage.companies.map((item) => (item.id === company.id ? company : item))
    : [...storage.companies, company];
  const selectedCompanyIds = storage.selectedCompanyIds.includes(company.id)
    ? storage.selectedCompanyIds
    : [...storage.selectedCompanyIds, company.id];
  return { ...storage, companies, activeCompanyId: company.id, selectedCompanyIds };
}

export function setActiveCompany(
  storage: AppStorage,
  id: string | null,
): AppStorage {
  const activeCompanyId =
    id && storage.companies.some((company) => company.id === id) ? id : null;
  const selectedCompanyIds =
    activeCompanyId && !storage.selectedCompanyIds.includes(activeCompanyId)
      ? [...storage.selectedCompanyIds, activeCompanyId]
      : storage.selectedCompanyIds;
  return { ...storage, activeCompanyId, selectedCompanyIds };
}

export function setSelectedCompanies(
  storage: AppStorage,
  ids: string[],
): AppStorage {
  const selectedCompanyIds = ids.filter((id) =>
    storage.companies.some((company) => company.id === id),
  );
  const activeCompanyId =
    storage.activeCompanyId &&
    selectedCompanyIds.includes(storage.activeCompanyId)
      ? storage.activeCompanyId
      : (selectedCompanyIds[0] ?? null);
  return {
    ...storage,
    selectedCompanyIds,
    activeCompanyId,
  };
}

export function toggleSelectedCompany(
  storage: AppStorage,
  id: string,
): AppStorage {
  if (!storage.companies.some((company) => company.id === id)) {
    return storage;
  }
  if (
    storage.selectedCompanyIds.includes(id) &&
    storage.activeCompanyId !== id
  ) {
    return { ...storage, activeCompanyId: id };
  }
  const selectedCompanyIds = storage.selectedCompanyIds.includes(id)
    ? storage.selectedCompanyIds.length > 1
      ? storage.selectedCompanyIds.filter((item) => item !== id)
      : storage.selectedCompanyIds
    : [...storage.selectedCompanyIds, id];
  const activeCompanyId = storage.selectedCompanyIds.includes(id)
    ? selectedCompanyIds[0] ?? null
    : id;
  return {
    ...storage,
    selectedCompanyIds,
    activeCompanyId,
  };
}

export function getActiveCompanies(storage: AppStorage): CompanyProfile[] {
  const selected = storage.selectedCompanyIds
    .map((id) => storage.companies.find((company) => company.id === id))
    .filter((company): company is CompanyProfile => Boolean(company));
  if (selected.length > 0) {
    return selected;
  }
  return getActiveCompany(storage) ? [getActiveCompany(storage) as CompanyProfile] : [];
}

export function getActiveCompany(storage: AppStorage): CompanyProfile | null {
  const active = storage.companies.find(
    (company) => company.id === storage.activeCompanyId,
  );
  if (active) {
    return active;
  }
  const selected = storage.selectedCompanyIds
    .map((id) => storage.companies.find((company) => company.id === id))
    .find(Boolean);
  if (selected) {
    return selected;
  }
  return (
    storage.companies.find(
      (company) => company.id === storage.activeCompanyId,
    ) ??
    storage.companies[0] ??
    null
  );
}

export function getActiveProfiles(storage: AppStorage): UserProfile[] {
  const selected = storage.selectedProfileIds
    .map((id) => storage.profiles.find((profile) => profile.id === id))
    .filter((profile): profile is UserProfile => Boolean(profile));
  if (selected.length > 0) {
    return selected;
  }
  return getActiveProfile(storage) ? [getActiveProfile(storage) as UserProfile] : [];
}

export function getActiveProfile(storage: AppStorage): UserProfile | null {
  const selected = storage.selectedProfileIds
    .map((id) => storage.profiles.find((profile) => profile.id === id))
    .find(Boolean);
  if (selected) {
    return selected;
  }
  return (
    storage.profiles.find(
      (profile) => profile.id === storage.activeProfileId,
    ) ??
    storage.profiles[0] ??
    null
  );
}

export function addSessionRecord(
  storage: AppStorage,
  record: SessionRecord,
): AppStorage {
  return { ...storage, history: [record, ...storage.history].slice(0, 50) };
}

export function upsertGroupDiscussionSession(
  storage: AppStorage,
  session: GroupDiscussionSessionRecord,
): AppStorage {
  const sessions = storage.groupDiscussionSessions.some(
    (item) => item.id === session.id,
  )
    ? storage.groupDiscussionSessions.map((item) =>
        item.id === session.id ? session : item,
      )
    : [session, ...storage.groupDiscussionSessions];
  return { ...storage, groupDiscussionSessions: sessions.slice(0, 50) };
}

export function deleteGroupDiscussionSession(
  storage: AppStorage,
  id: string,
): AppStorage {
  return {
    ...storage,
    groupDiscussionSessions: storage.groupDiscussionSessions.filter(
      (session) => session.id !== id,
    ),
  };
}

export function saveLearning(
  storage: AppStorage,
  learning: PreInterviewLearning,
): AppStorage {
  return { ...storage, learning };
}
