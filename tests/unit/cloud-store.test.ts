import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: supabaseMocks.createSupabaseServiceClient,
}));

import { createEmptyUserProfile } from "@/lib/schemas/interview";
import { saveCloudStorage } from "@/lib/storage/cloud-store";
import { defaultStorage } from "@/lib/storage/browser-store";

const testUserId = "00000000-0000-4000-8000-000000000004";

type SupabaseResult = {
  data: unknown;
  error: null;
};

function createQuery(result: SupabaseResult) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    delete: vi.fn(() => query),
    upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (
      resolve: (value: SupabaseResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

describe("cloud storage persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects accidental empty overwrites when existing cloud slots are present", async () => {
    const existingProfile = {
      ...createEmptyUserProfile(),
      id: "profile-existing",
      label: "既存プロフィール",
    };
    const from = vi.fn((table: string) => {
      if (table === "personal_slots") {
        return createQuery({
          data: [{ id: existingProfile.id, content: existingProfile }],
          error: null,
        });
      }
      if (table === "user_settings") {
        return createQuery({ data: null, error: null });
      }
      return createQuery({ data: [], error: null });
    });

    supabaseMocks.createSupabaseServiceClient.mockReturnValue({ from });

    await expect(saveCloudStorage(testUserId, defaultStorage)).rejects.toThrow(
      "空のデータでは上書きしません",
    );
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "personal_slots",
      "company_slots",
      "interview_sessions",
      "interview_messages",
      "user_settings",
      "local_storage_imports",
    ]);
  });
});
