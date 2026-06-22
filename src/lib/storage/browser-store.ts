import {
  appStorageSchema,
  type AppStorage,
  type CompanyProfile,
  type SessionRecord,
  type UserProfile,
} from "@/lib/schemas/interview";

export const STORAGE_KEY = "jp-interview-assistant:v1";

export const defaultStorage: AppStorage = {
  profiles: [],
  companies: [],
  history: [],
  privacy: {
    saveHistoryByDefault: false,
  },
};

export function loadAppStorage(): AppStorage {
  if (typeof window === "undefined") {
    return defaultStorage;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultStorage;
  }
  const parsed: unknown = JSON.parse(raw);
  return appStorageSchema.catch(defaultStorage).parse(parsed);
}

export function saveAppStorage(next: AppStorage): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearAppStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}

export function upsertProfile(
  storage: AppStorage,
  profile: UserProfile,
): AppStorage {
  const profiles = storage.profiles.some((item) => item.id === profile.id)
    ? storage.profiles.map((item) => (item.id === profile.id ? profile : item))
    : [...storage.profiles, profile];
  return { ...storage, profiles };
}

export function upsertCompany(
  storage: AppStorage,
  company: CompanyProfile,
): AppStorage {
  const companies = storage.companies.some((item) => item.id === company.id)
    ? storage.companies.map((item) => (item.id === company.id ? company : item))
    : [...storage.companies, company];
  return { ...storage, companies };
}

export function addSessionRecord(
  storage: AppStorage,
  record: SessionRecord,
): AppStorage {
  return { ...storage, history: [record, ...storage.history].slice(0, 50) };
}
