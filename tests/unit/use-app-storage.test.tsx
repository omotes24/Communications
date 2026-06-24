import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  defaultStorage,
  saveAppStorage,
  upsertProfile,
} from "@/lib/storage/browser-store";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import { createEmptyUserProfile } from "@/lib/schemas/interview";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("useAppStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
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
});
