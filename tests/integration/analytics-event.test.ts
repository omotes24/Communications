import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  getServerSupabaseConfig: vi.fn(),
}));

vi.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: () => ({ ok: true }),
  rateLimitResponse: () => new Response(null, { status: 429 }),
}));

vi.mock("@/lib/auth/server", () => ({
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("@/lib/supabase/server-config", () => ({
  getServerSupabaseConfig: mocks.getServerSupabaseConfig,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({
    from: mocks.from,
    rpc: mocks.rpc,
  }),
}));

import { POST } from "@/app/api/analytics/event/route";

const pageView = {
  eventName: "page_view",
  feature: "home",
  pathGroup: "/",
  sessionId: "session-test-1234",
  deviceCategory: "desktop",
  metadata: { source: "app" },
};

function request(
  body: unknown = pageView,
  origin = "https://www.yell-for-you.jp",
): Request {
  return new Request("https://www.yell-for-you.jp/api/analytics/event", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
    },
    body: JSON.stringify(body),
  });
}

describe("web analytics event route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_PRODUCT_ANALYTICS_ENABLED = "true";
    process.env.ADMIN_AUDIT_HMAC_SECRET = "test-secret-at-least-32-bytes-long";
    mocks.getServerSupabaseConfig.mockReturnValue({
      url: "https://example.supabase.co",
      anonKey: "anon",
      serviceRoleKey: "service-role",
    });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.rpc.mockResolvedValue({ data: 0, error: null });
    mocks.requireApiUser.mockResolvedValue({
      ok: true,
      user: { id: "user-id", email: "user@example.com" },
    });
  });

  it("records an anonymous same-origin page view with only a hashed session", async () => {
    const response = await POST(request());

    expect(response.status).toBe(202);
    expect(mocks.requireApiUser).not.toHaveBeenCalled();
    expect(mocks.from).toHaveBeenCalledWith("web_analytics_page_views");
    expect(mocks.insert).toHaveBeenCalledWith({
      session_hash: createHmac("sha256", "test-secret-at-least-32-bytes-long")
        .update("web-session:session-test-1234")
        .digest("hex"),
      path_group: "/",
      device_category: "desktop",
    });
    expect(JSON.stringify(mocks.insert.mock.calls)).not.toContain(
      "session-test-1234",
    );
  });

  it("does not reveal the collector to cross-origin requests", async () => {
    const response = await POST(request(pageView, "https://attacker.example"));

    expect(response.status).toBe(404);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("excludes administrator page views", async () => {
    const response = await POST(
      request({ ...pageView, feature: "admin", pathGroup: "/admin/analytics" }),
    );

    expect(response.status).toBe(204);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("is inert while analytics is disabled", async () => {
    process.env.NEXT_PUBLIC_PRODUCT_ANALYTICS_ENABLED = "false";

    const response = await POST(request());

    expect(response.status).toBe(204);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects paths that could contain query strings or personal data", async () => {
    const response = await POST(
      request({ ...pageView, pathGroup: "/profile?email=user@example.com" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
