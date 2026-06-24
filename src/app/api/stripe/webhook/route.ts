import Stripe from "stripe";

import {
  createStripeClient,
  requireStripeWebhookSecret,
} from "@/lib/billing/stripe";
import { getBillingPlan } from "@/lib/billing/plans";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handledEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonError("Stripe署名がありません。", 400);
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = createStripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      requireStripeWebhookSecret(),
    );
  } catch {
    return jsonError("Stripe webhook署名の検証に失敗しました。", 400);
  }

  if (!handledEvents.has(event.type)) {
    return Response.json({ received: true });
  }

  try {
    await grantTokensForCheckoutSession(
      event.data.object as Stripe.Checkout.Session,
      event.id,
    );
    return Response.json({ received: true });
  } catch (error) {
    return jsonError(toPublicError(error), 400);
  }
}

async function grantTokensForCheckoutSession(
  session: Stripe.Checkout.Session,
  eventId: string,
): Promise<void> {
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return;
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
}

function toStripeId(value: string | { id: string } | null): string | null {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : value.id;
}
