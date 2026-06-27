import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  defaultStorage,
  saveAppStorage,
  upsertCompany,
  upsertProfile,
} from "@/lib/storage/browser-store";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import {
  createEmptyCompanyProfile,
  createEmptyUserProfile,
} from "@/lib/schemas/interview";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("useAppStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("does not hydrate account storage from legacy localStorage", async () => {
    const legacyProfile = {
      ...createEmptyUserProfile(),
      id: "legacy-profile",
      label: "前のブラウザデータ",
    };
    saveAppStorage(upsertProfile(defaultStorage, legacyProfile));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "ログインが必要です。" }, { status: 401 }),
    );

    const { result } = renderHook(() => useAppStorage());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.storage.profiles).toEqual([]);
  });

  it("uses the authenticated cloud storage instead of browser cache", async () => {
    const legacyProfile = {
      ...createEmptyUserProfile(),
      id: "legacy-profile",
      label: "前のブラウザデータ",
    };
    const cloudProfile = {
      ...createEmptyUserProfile(),
      id: "cloud-profile",
      label: "アカウントのデータ",
    };
    saveAppStorage(upsertProfile(defaultStorage, legacyProfile));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        storage: upsertProfile(defaultStorage, cloudProfile),
        hasCloudData: true,
        importedLocalStorage: false,
      }),
    );

    const { result } = renderHook(() => useAppStorage());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.storage.profiles).toHaveLength(1);
    expect(result.current.storage.profiles[0]?.id).toBe("cloud-profile");
  });

  it("keeps a save made before initial cloud storage finishes loading", async () => {
    const profile = {
      ...createEmptyUserProfile(),
      id: "new-profile",
      label: "入力中の保存",
    };
    let resolveCloudLoad!: (response: Response) => void;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((_input, init) => {
        if (init?.method === "PUT") {
          return Promise.resolve(jsonResponse({ ok: true }));
        }
        return new Promise<Response>((resolve) => {
          resolveCloudLoad = resolve;
        });
      });

    const { result } = renderHook(() => useAppStorage());

    act(() => {
      result.current.actions.saveProfile(profile);
    });

    expect(result.current.storage.profiles[0]?.id).toBe("new-profile");

    act(() => {
      resolveCloudLoad(
        jsonResponse({
          storage: defaultStorage,
          hasCloudData: false,
          importedLocalStorage: false,
        }),
      );
    });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.storage.profiles[0]?.id).toBe("new-profile");
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/storage",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
  });

  it("keeps the newly selected company active during same-session navigation", async () => {
    const companyA = {
      ...createEmptyCompanyProfile(),
      id: "company-a",
      companyName: "MRI",
    };
    const companyB = {
      ...createEmptyCompanyProfile(),
      id: "company-b",
      companyName: "三菱UFJ銀行",
    };
    const cloudStorage = upsertCompany(
      upsertCompany(defaultStorage, companyA),
      companyB,
    );
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        storage: cloudStorage,
        hasCloudData: true,
        importedLocalStorage: false,
      }),
    );

    const firstHook = renderHook(() => useAppStorage());
    await waitFor(() => expect(firstHook.result.current.ready).toBe(true));

    act(() => {
      firstHook.result.current.actions.setActiveCompany("company-b");
    });

    fetchMock.mockResolvedValue(
      jsonResponse({
        storage: { ...cloudStorage, activeCompanyId: "company-a" },
        hasCloudData: true,
        importedLocalStorage: false,
      }),
    );

    const secondHook = renderHook(() => useAppStorage());
    await waitFor(() => expect(secondHook.result.current.ready).toBe(true));

    expect(secondHook.result.current.activeCompany?.id).toBe("company-b");
    expect(secondHook.result.current.activeCompany?.companyName).toBe(
      "三菱UFJ銀行",
    );
  });
});
