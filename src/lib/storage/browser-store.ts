import {
  appStorageSchema,
  type AppStorage,
  type CompanyProfile,
  type PreInterviewLearning,
  type SessionRecord,
  type UserProfile,
} from "@/lib/schemas/interview";

export const STORAGE_KEY = "jp-interview-assistant:v1";
export const COMPANY_FORM_DRAFT_KEY =
  "jp-interview-assistant:company-form-draft:v1";
export const APP_STORAGE_EVENT = "jp-interview-assistant:storage-updated";

export const defaultStorage: AppStorage = {
  profiles: [],
  companies: [],
  history: [],
  learning: null,
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
  const companies = [
    company,
    ...storage.companies.filter((item) => item.id !== company.id),
  ];
  return { ...storage, companies };
}

export function addSessionRecord(
  storage: AppStorage,
  record: SessionRecord,
): AppStorage {
  return { ...storage, history: [record, ...storage.history].slice(0, 50) };
}

export function saveLearning(
  storage: AppStorage,
  learning: PreInterviewLearning,
): AppStorage {
  return { ...storage, learning };
}
