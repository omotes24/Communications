import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
  getServerSupabaseConfig: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/supabase/server-config", () => ({
  getServerSupabaseConfig: mocks.getServerSupabaseConfig,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
}));

import { GET } from "@/app/api/admin/analytics/route";

const ownerId = "12345678-1234-4abc-8def-1234567890ab";

const summary = {
  rangeDays: 30,
  startsAt: "2026-06-16T15:00:00+00:00",
  endsAt: "2026-07-16T15:00:00+00:00",
  pageViews: 120,
  sessions: 40,
  pagesPerSession: 3,
  singlePageRate: 25,
  todayPageViews: 12,
  todaySessions: 5,
  collectedSince: "2026-07-15T00:00:00+00:00",
  lastReceivedAt: "2026-07-15T04:00:00+00:00",
  daily: [{ day: "2026-07-15", pageViews: 12, sessions: 5 }],
  topPages: [{ pathGroup: "/", pageViews: 80, sessions: 35 }],
  devices: [{ deviceCategory: "desktop", pageViews: 80, sessions: 30 }],
  recent: [
    {
      pathGroup: "/",
      deviceCategory: "desktop",
      createdAt: "2026-07-15T04:00:00+00:00",
    },
  ],
};

describe("administrator web analytics route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_USER_IDS = ownerId;
    process.env.NEXT_PUBLIC_PRODUCT_ANALYTICS_ENABLED = "true";
    delete process.env.XYZ_KEY;
    mocks.getCurrentUser.mockResolvedValue({
      id: ownerId,
      email: "kotaro3150@keio.jp",
      source: "supabase",
    });
    mocks.getServerSupabaseConfig.mockReturnValue({
      url: "https://example.supabase.co",
      anonKey: "anon",
      serviceRoleKey: "service-role",
    });
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "prune_web_analytics_page_views") {
        return Promise.resolve({ data: 0, error: null });
      }
      return Promise.resolve({ data: summary, error: null });
    });
    mocks.createSupabaseServiceClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("returns aggregate-only analytics with private no-store caching", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/analytics?days=30"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("vary")).toContain("Cookie");
    expect(body).toMatchObject({
      configured: true,
      collectionEnabled: true,
      pageViews: 120,
      sessions: 40,
      retentionDays: 90,
    });
    expect(JSON.stringify(body)).not.toContain(ownerId);
    expect(JSON.stringify(body)).not.toContain("session_hash");
    expect(mocks.rpc).toHaveBeenCalledWith("get_web_analytics_summary", {
      p_days: 30,
    });
  });

  it("returns the fixed denial before storage and ignores fake XYZ inputs", async () => {
    process.env.XYZ_KEY = "fake-environment-key";
    mocks.getCurrentUser.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      email: "kotaro3150@keio.jp",
      source: "supabase",
    });

    const response = await GET(
      new Request(
        "http://localhost/api/admin/analytics?days=30&xyzKey=anything",
        {
          headers: {
            Authorization: "Bearer XYZ",
            Cookie: "xyzKey=anything",
            "X-XYZ-Key": "anything",
          },
        },
      ),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "XYZキーが必要です。",
    });
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("vary")).toContain("Cookie");
    expect(mocks.createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("fails closed when the authentication backend errors", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("auth unavailable"));

    const response = await GET(
      new Request("http://localhost/api/admin/analytics?days=30"),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "XYZキーが必要です。",
    });
    expect(mocks.createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("rejects unsupported ranges after administrator authorization", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/analytics?days=365"),
    );

    expect(response.status).toBe(400);
    expect(mocks.createSupabaseServiceClient).not.toHaveBeenCalled();
  });
});
