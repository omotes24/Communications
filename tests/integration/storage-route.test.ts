import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultStorage } from "@/lib/storage/browser-store";

const storageMocks = vi.hoisted(() => ({
  loadCloudStorage: vi.fn(),
  saveCloudStorage: vi.fn(),
}));

vi.mock("@/lib/storage/cloud-store", () => ({
  loadCloudStorage: storageMocks.loadCloudStorage,
  saveCloudStorage: storageMocks.saveCloudStorage,
}));

import { GET, PUT } from "@/app/api/storage/route";

const testUserId = "00000000-0000-4000-8000-000000000003";

describe("storage route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TEST_AUTH_USER_ID = testUserId;
    storageMocks.loadCloudStorage.mockResolvedValue({
      storage: defaultStorage,
      hasCloudData: false,
      importedLocalStorage: false,
    });
    storageMocks.saveCloudStorage.mockResolvedValue(undefined);
  });

  it("loads the current user's cloud storage", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(storageMocks.loadCloudStorage).toHaveBeenCalledWith(testUserId);
    await expect(response.json()).resolves.toMatchObject({
      storage: defaultStorage,
      hasCloudData: false,
    });
  });

  it("treats legacy storage PUT requests as protected from empty overwrites", async () => {
    const response = await PUT(
      new Request("http://localhost/api/storage", {
        method: "PUT",
        body: JSON.stringify(defaultStorage),
      }),
    );

    expect(response.status).toBe(200);
    expect(storageMocks.saveCloudStorage).toHaveBeenCalledWith(
      testUserId,
      defaultStorage,
      { allowEmptyOverwrite: false },
    );
  });

  it("allows explicit account data clearing to overwrite with empty storage", async () => {
    const response = await PUT(
      new Request("http://localhost/api/storage", {
        method: "PUT",
        body: JSON.stringify({
          storage: defaultStorage,
          allowEmptyOverwrite: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(storageMocks.saveCloudStorage).toHaveBeenCalledWith(
      testUserId,
      defaultStorage,
      { allowEmptyOverwrite: true },
    );
  });
});
