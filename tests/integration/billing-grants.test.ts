import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  retrieveSession: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/billing/stripe", () => ({
  createStripeClient: () => ({
    checkout: {
      sessions: {
        retrieve: mocks.retrieveSession,
      },
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({
    rpc: mocks.rpc,
  }),
}));

import { settleCheckoutSessionForUser } from "@/lib/billing/grants";

const userId = "00000000-0000-4000-8000-000000000003";
const paidSession = {
  id: "cs_test_123",
  mode: "payment",
  payment_status: "paid",
  client_reference_id: userId,
  metadata: {
    userId,
    planId: "standard",
    tokenAmount: "900000",
    amountJpy: "3000",
  },
  currency: "jpy",
  amount_total: 3000,
  payment_intent: "pi_test_123",
  customer: "cus_test_123",
  livemode: false,
};

describe("billing checkout settlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.retrieveSession.mockResolvedValue(paidSession);
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it("settles a paid Checkout Session for the signed-in user", async () => {
    await expect(
      settleCheckoutSessionForUser("cs_test_123", userId),
    ).resolves.toBe("settled");

    expect(mocks.retrieveSession).toHaveBeenCalledWith("cs_test_123");
    expect(mocks.rpc).toHaveBeenCalledWith("grant_purchased_tokens", {
      p_user_id: userId,
      p_amount: 900000,
      p_request_id: "stripe:cs_test_123",
      p_plan_id: "standard",
      p_amount_jpy: 3000,
      p_currency: "jpy",
      p_stripe_checkout_session_id: "cs_test_123",
      p_stripe_payment_intent_id: "pi_test_123",
      p_stripe_customer_id: "cus_test_123",
      p_livemode: false,
      p_event_id: "checkout-return:cs_test_123",
      p_metadata: { source: "stripe_checkout" },
    });
  });

  it("does not settle a Checkout Session owned by another user", async () => {
    await expect(
      settleCheckoutSessionForUser(
        "cs_test_123",
        "00000000-0000-4000-8000-000000000004",
      ),
    ).rejects.toThrow("belongs to another user");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
