import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  APP_STORAGE_EVENT,
  clearAppStorage,
  defaultStorage,
  saveAppStorage,
  upsertCompany,
} from "@/lib/storage/browser-store";
import { createEmptyCompanyProfile } from "@/lib/schemas/interview";

describe("browser storage helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps the active company at the front", () => {
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
      "company-b",
      "company-a",
    ]);
    expect(next.companies[0].targetRole).toBe("更新済みコース");
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
