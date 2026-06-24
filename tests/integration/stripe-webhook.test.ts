import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/billing/stripe", () => ({
  createStripeClient: () => ({
    webhooks: {
      constructEvent: mocks.constructEvent,
    },
  }),
  requireStripeWebhookSecret: () => "whsec_test",
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({
    rpc: mocks.rpc,
  }),
}));

import { POST } from "@/app/api/stripe/webhook/route";

const paidSession = {
  id: "cs_test_123",
  mode: "payment",
  payment_status: "paid",
  client_reference_id: "00000000-0000-4000-8000-000000000003",
  metadata: {
    userId: "00000000-0000-4000-8000-000000000003",
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

describe("Stripe webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.constructEvent.mockReturnValue({
      id: "evt_test_123",
      type: "checkout.session.completed",
      data: { object: paidSession },
    });
  });

  it("rejects requests without a Stripe signature header", async () => {
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("grants purchased tokens for a paid Checkout Session", async () => {
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=test,v1=test" },
        body: JSON.stringify({ id: "evt_test_123" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.constructEvent).toHaveBeenCalledWith(
      JSON.stringify({ id: "evt_test_123" }),
      "t=test,v1=test",
      "whsec_test",
    );
    expect(mocks.rpc).toHaveBeenCalledWith("grant_purchased_tokens", {
      p_user_id: "00000000-0000-4000-8000-000000000003",
      p_amount: 900000,
      p_request_id: "stripe:cs_test_123",
      p_plan_id: "standard",
      p_amount_jpy: 3000,
      p_currency: "jpy",
      p_stripe_checkout_session_id: "cs_test_123",
      p_stripe_payment_intent_id: "pi_test_123",
      p_stripe_customer_id: "cus_test_123",
      p_livemode: false,
      p_event_id: "evt_test_123",
      p_metadata: { source: "stripe_checkout" },
    });
  });

  it("does not grant tokens for unpaid Checkout Sessions", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_test_124",
      type: "checkout.session.completed",
      data: {
        object: {
          ...paidSession,
          payment_status: "unpaid",
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=test,v1=test" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects sessions with mismatched user references", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_test_125",
      type: "checkout.session.completed",
      data: {
        object: {
          ...paidSession,
          metadata: {
            ...paidSession.metadata,
            userId: "00000000-0000-4000-8000-000000000004",
          },
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=test,v1=test" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
