import "server-only";

import Stripe from "stripe";

import { createStripeClient } from "@/lib/billing/stripe";
import { getBillingPlan } from "@/lib/billing/plans";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type CheckoutSettlementResult = "settled" | "not_paid";

export async function settleCheckoutSessionForUser(
  sessionId: string,
  userId: string,
): Promise<CheckoutSettlementResult> {
  if (!sessionId.startsWith("cs_")) {
    throw new Error("Invalid Stripe Checkout Session ID.");
  }

  const session = await createStripeClient().checkout.sessions.retrieve(
    sessionId,
  );
  return grantTokensForCheckoutSession(
    session,
    `checkout-return:${session.id}`,
    {
      expectedUserId: userId,
    },
  );
}

export async function grantTokensForCheckoutSession(
  session: Stripe.Checkout.Session,
  eventId: string,
  options: { expectedUserId?: string } = {},
): Promise<CheckoutSettlementResult> {
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return "not_paid";
  }

  const planId = session.metadata?.planId;
  const clientReferenceUserId = session.client_reference_id;
  const metadataUserId = session.metadata?.userId;
  if (
    clientReferenceUserId &&
    metadataUserId &&
    clientReferenceUserId !== metadataUserId
  ) {
    throw new Error("Stripe Checkout Session user reference does not match.");
  }

  const userId = clientReferenceUserId ?? metadataUserId;
  if (!planId || !userId) {
    throw new Error("Stripe Checkout Session metadata is incomplete.");
  }
  if (options.expectedUserId && options.expectedUserId !== userId) {
    throw new Error("Stripe Checkout Session belongs to another user.");
  }

  const plan = getBillingPlan(planId);
  if (!plan) {
    throw new Error("Stripe Checkout Session plan is unknown.");
  }

  const currency = session.currency?.toLowerCase() ?? "jpy";
  if (currency !== "jpy" || session.amount_total !== plan.amountJpy) {
    throw new Error("Stripe Checkout Session amount does not match the plan.");
  }

  const metadataTokenAmount = Number(session.metadata?.tokenAmount);
  if (metadataTokenAmount !== plan.tokenAmount) {
    throw new Error("Stripe Checkout Session token amount does not match.");
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.rpc("grant_purchased_tokens", {
    p_user_id: userId,
    p_amount: plan.tokenAmount,
    p_request_id: `stripe:${session.id}`,
    p_plan_id: plan.id,
    p_amount_jpy: plan.amountJpy,
    p_currency: currency,
    p_stripe_checkout_session_id: session.id,
    p_stripe_payment_intent_id: toStripeId(session.payment_intent),
    p_stripe_customer_id: toStripeId(session.customer),
    p_livemode: session.livemode,
    p_event_id: eventId,
    p_metadata: {
      source: "stripe_checkout",
    },
  });

  if (error) {
    throw error;
  }

  return "settled";
}

function toStripeId(value: string | { id: string } | null): string | null {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : value.id;
}
