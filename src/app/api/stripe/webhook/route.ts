import Stripe from "stripe";

import {
  createStripeClient,
  requireStripeWebhookSecret,
} from "@/lib/billing/stripe";
import { grantTokensForCheckoutSession } from "@/lib/billing/grants";
import { jsonError, toPublicError } from "@/lib/privacy/logging";

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
