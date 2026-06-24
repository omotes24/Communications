import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  APP_STORAGE_EVENT,
  clearAppStorage,
  defaultStorage,
  saveAppStorage,
  toggleSelectedCompany,
  toggleSelectedProfile,
  upsertCompany,
  upsertProfile,
} from "@/lib/storage/browser-store";
import {
  createEmptyCompanyProfile,
  createEmptyUserProfile,
} from "@/lib/schemas/interview";

describe("browser storage helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps slot order when updating the active company", () => {
    const first = {
      ...createEmptyCompanyProfile(),
      id: "company-a",
      label: "A",
      companyName: "A社",
    };
    const second = {
      ...createEmptyCompanyProfile(),
      id: "company-b",
      label: "B",
      companyName: "B社",
    };

    const storage = {
      ...defaultStorage,
      companies: [first, second],
    };

    const next = upsertCompany(storage, {
      ...second,
      targetRole: "更新済みコース",
    });

    expect(next.companies.map((company) => company.id)).toEqual([
      "company-a",
      "company-b",
    ]);
    expect(next.companies[1].targetRole).toBe("更新済みコース");
    expect(next.activeCompanyId).toBe("company-b");
  });

  it("keeps multiple selected profile and company slots", () => {
    const profileA = { ...createEmptyUserProfile(), id: "profile-a" };
    const profileB = { ...createEmptyUserProfile(), id: "profile-b" };
    const companyA = { ...createEmptyCompanyProfile(), id: "company-a" };
    const companyB = { ...createEmptyCompanyProfile(), id: "company-b" };

    const withProfiles = upsertProfile(
      upsertProfile(defaultStorage, profileA),
      profileB,
    );
    expect(withProfiles.selectedProfileIds).toEqual([
      "profile-a",
      "profile-b",
    ]);
    const stillHasOneProfile = toggleSelectedProfile(
      toggleSelectedProfile(withProfiles, "profile-a"),
      "profile-b",
    );
    expect(stillHasOneProfile.selectedProfileIds).toEqual(["profile-b"]);

    const withCompanies = upsertCompany(
      upsertCompany(defaultStorage, companyA),
      companyB,
    );
    expect(withCompanies.selectedCompanyIds).toEqual([
      "company-a",
      "company-b",
    ]);
    const stillHasOneCompany = toggleSelectedCompany(
      toggleSelectedCompany(withCompanies, "company-a"),
      "company-b",
    );
    expect(stillHasOneCompany.selectedCompanyIds).toEqual(["company-b"]);
  });

  it("notifies same-tab subscribers when storage changes", () => {
    const listener = vi.fn();
    window.addEventListener(APP_STORAGE_EVENT, listener);

    saveAppStorage(defaultStorage);
    clearAppStorage();

    window.removeEventListener(APP_STORAGE_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
