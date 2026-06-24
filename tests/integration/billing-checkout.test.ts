import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessionsCreate: vi.fn(),
  requireServiceRoleKey: vi.fn(),
}));

vi.mock("@/lib/billing/stripe", () => ({
  createStripeClient: () => ({
    checkout: {
      sessions: {
        create: mocks.sessionsCreate,
      },
    },
  }),
}));

vi.mock("@/lib/supabase/server-config", () => ({
  requireSupabaseServiceRoleKey: mocks.requireServiceRoleKey,
}));

import { POST } from "@/app/api/billing/checkout/route";

const testUserId = "00000000-0000-4000-8000-000000000002";

describe("billing checkout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TEST_AUTH_USER_ID = testUserId;
    mocks.requireServiceRoleKey.mockReturnValue("service-role-test");
    mocks.sessionsCreate.mockResolvedValue({
      url: "https://checkout.stripe.test/session",
    });
  });

  it("creates a Stripe Checkout Session for a token plan", async () => {
    const response = await POST(
      new Request("https://app.example.test/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planId: "standard" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://checkout.stripe.test/session",
    });
    expect(mocks.sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        client_reference_id: testUserId,
        success_url:
          "https://app.example.test/account/usage?checkout=success&session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://app.example.test/pricing?checkout=cancelled",
        metadata: expect.objectContaining({
          userId: testUserId,
          planId: "standard",
          tokenAmount: "900000",
          amountJpy: "3000",
        }),
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: "jpy",
              unit_amount: 3000,
            }),
          }),
        ],
      }),
    );
  });

  it("rejects unknown plans before creating a Stripe Session", async () => {
    const response = await POST(
      new Request("https://app.example.test/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planId: "missing" }),
      }),
    );

    expect(response.status).toBe(404);
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects checkout when token grants cannot be written", async () => {
    mocks.requireServiceRoleKey.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEYが設定されていません。");
    });

    const response = await POST(
      new Request("https://app.example.test/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planId: "standard" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });
});
