import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({
    auth: {
      admin: {
        listUsers: mocks.listUsers,
      },
    },
  }),
}));

import { POST } from "@/app/api/auth/sign-up/check-email/route";

describe("signup email check route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects an existing auth user before signup sends email", async () => {
    mocks.listUsers.mockResolvedValue({
      data: {
        users: [
          { email: "other@example.com" },
          { email: "Existing@Example.com" },
        ],
      },
      error: null,
    });

    const response = await POST(
      new Request("http://localhost/api/auth/sign-up/check-email", {
        method: "POST",
        body: JSON.stringify({ email: "existing@example.com" }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ exists: true });
  });

  it("returns false when the email is not registered", async () => {
    mocks.listUsers.mockResolvedValue({
      data: { users: [{ email: "other@example.com" }] },
      error: null,
    });

    const response = await POST(
      new Request("http://localhost/api/auth/sign-up/check-email", {
        method: "POST",
        body: JSON.stringify({ email: "new@example.com" }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ exists: false });
  });
});
