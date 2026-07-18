import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
  getServerSupabaseConfig: vi.fn(),
  isInterviewExperienceEnabled: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
}));

vi.mock("@/lib/supabase/server-config", () => ({
  getServerSupabaseConfig: mocks.getServerSupabaseConfig,
}));

vi.mock("@/lib/features/server", () => ({
  isInterviewExperienceEnabled: mocks.isInterviewExperienceEnabled,
}));

import { GET as getAdminStats } from "@/app/api/admin/stats/route";
import { GET as getAdminExport } from "@/app/api/admin/export/[dataset]/route";
import {
  DELETE as deleteInterviewExperience,
  GET as getInterviewExperiences,
  POST as saveInterviewExperience,
} from "@/app/api/interview-experiences/route";
import { POST as draftInterviewExperience } from "@/app/api/interview-experiences/draft/route";

const ownerId = "12345678-1234-4abc-8def-1234567890ab";

function fakeKeyRequest(path: string, method = "GET"): Request {
  return new Request(`http://localhost${path}?xyzKey=anything`, {
    method,
    headers: {
      Authorization: "Bearer XYZ",
      Cookie: "xyzKey=anything",
      "Content-Type": "application/json",
      "X-XYZ-Key": "anything",
    },
    body: method === "GET" ? undefined : JSON.stringify({ xyzKey: "anything" }),
  });
}

async function expectFixedDenial(response: Response): Promise<void> {
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "XYZキーが必要です。" });
  expect(response.headers.get("cache-control")).toBe(
    "private, no-store, max-age=0",
  );
  expect(response.headers.get("vary")).toContain("Cookie");
}

describe("administrator sensitive route boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_USER_IDS = ownerId;
    process.env.XYZ_KEY = "fake-environment-key";
    mocks.getCurrentUser.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      email: "kotaro3150@keio.jp",
      source: "supabase",
    });
    mocks.getServerSupabaseConfig.mockReturnValue({
      url: "https://example.supabase.co",
      anonKey: "anon",
      serviceRoleKey: "service-role",
    });
    mocks.isInterviewExperienceEnabled.mockReturnValue(true);
  });

  function authenticateOwner() {
    mocks.getCurrentUser.mockResolvedValue({
      id: ownerId,
      email: "kotaro3150@keio.jp",
      source: "supabase",
    });
  }

  it("rejects statistics and every CSV dataset before database access", async () => {
    await expectFixedDenial(await getAdminStats());

    for (const dataset of [
      "customers",
      "purchases",
      "usage",
      "daily",
      "events",
      "interview_experiences",
    ]) {
      await expectFixedDenial(
        await getAdminExport(fakeKeyRequest(`/api/admin/export/${dataset}`), {
          params: Promise.resolve({ dataset }),
        }),
      );
    }

    expect(mocks.createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("rejects all interview-experience operations before feature or data access", async () => {
    await expectFixedDenial(await getInterviewExperiences());
    await expectFixedDenial(
      await saveInterviewExperience(
        fakeKeyRequest("/api/interview-experiences", "POST"),
      ),
    );
    await expectFixedDenial(
      await deleteInterviewExperience(
        fakeKeyRequest("/api/interview-experiences", "DELETE"),
      ),
    );
    await expectFixedDenial(
      await draftInterviewExperience(
        fakeKeyRequest("/api/interview-experiences/draft", "POST"),
      ),
    );

    expect(mocks.isInterviewExperienceEnabled).not.toHaveBeenCalled();
    expect(mocks.createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("uses private no-store responses for authorized interview data", async () => {
    authenticateOwner();
    mocks.getServerSupabaseConfig.mockReturnValue({
      url: "https://example.supabase.co",
      anonKey: "anon",
      serviceRoleKey: "",
    });

    const response = await getInterviewExperiences();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("vary")).toContain("Cookie");
  });

  it("fails closed before database access when the audit HMAC is missing", async () => {
    authenticateOwner();
    delete process.env.ADMIN_AUDIT_HMAC_SECRET;

    const statsResponse = await getAdminStats();
    expect(statsResponse.status).toBe(503);
    expect(await statsResponse.json()).toEqual({
      error: "管理用匿名化キーが未設定です。",
    });

    const exportResponse = await getAdminExport(
      fakeKeyRequest("/api/admin/export/customers"),
      { params: Promise.resolve({ dataset: "customers" }) },
    );
    expect(exportResponse.status).toBe(503);
    expect(await exportResponse.json()).toEqual({
      error: "管理用匿名化キーが未設定です。",
    });
    expect(mocks.createSupabaseServiceClient).not.toHaveBeenCalled();
  });
});
