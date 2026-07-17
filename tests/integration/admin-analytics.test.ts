import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminApiUser: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
  getServerSupabaseConfig: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/auth/admin", () => ({
  requireAdminApiUser: mocks.requireAdminApiUser,
}));

vi.mock("@/lib/supabase/server-config", () => ({
  getServerSupabaseConfig: mocks.getServerSupabaseConfig,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
}));

import { GET } from "@/app/api/admin/analytics/route";

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
    process.env.NEXT_PUBLIC_PRODUCT_ANALYTICS_ENABLED = "true";
    mocks.requireAdminApiUser.mockResolvedValue({
      ok: true,
      user: { id: "admin-id", email: "admin@example.com" },
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
    expect(JSON.stringify(body)).not.toContain("admin-id");
    expect(JSON.stringify(body)).not.toContain("session_hash");
    expect(mocks.rpc).toHaveBeenCalledWith("get_web_analytics_summary", {
      p_days: 30,
    });
  });

  it("returns 404 before touching analytics storage for non-admins", async () => {
    mocks.requireAdminApiUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Not found" }, { status: 404 }),
    });

    const response = await GET(
      new Request("http://localhost/api/admin/analytics?days=30"),
    );

    expect(response.status).toBe(404);
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
