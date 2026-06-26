import { z } from "zod";

import { requireApiUser } from "@/lib/auth/server";
import { createStripeClient } from "@/lib/billing/stripe";
import { getBillingPlan } from "@/lib/billing/plans";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import { requireSupabaseServiceRoleKey } from "@/lib/supabase/server-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const checkoutRequestSchema = z.object({
  planId: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = checkoutRequestSchema.parse(await request.json());
    const plan = getBillingPlan(body.planId);
    if (!plan) {
      return jsonError("指定されたプランが見つかりません。", 404);
    }

    requireSupabaseServiceRoleKey();

    const origin = new URL(request.url).origin;
    const stripe = createStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "ja",
      client_reference_id: auth.user.id,
      customer_email: auth.user.email ?? undefined,
      success_url: `${origin}/account/usage?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      metadata: {
        userId: auth.user.id,
        planId: plan.id,
        tokenAmount: String(plan.tokenAmount),
        amountJpy: String(plan.amountJpy),
      },
      payment_intent_data: {
        metadata: {
          userId: auth.user.id,
          planId: plan.id,
          tokenAmount: String(plan.tokenAmount),
          amountJpy: String(plan.amountJpy),
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: plan.amountJpy,
            product_data: {
              name: `Yell for You 1.2 ${plan.name} tokens`,
              description: `${plan.tokenAmount.toLocaleString()} app tokens`,
            },
          },
        },
      ],
    });

    if (!session.url) {
      return jsonError("Checkout URLを作成できませんでした。", 502);
    }

    return Response.json({ url: session.url });
  } catch (error) {
    return jsonError(toPublicError(error), 400);
  }
}
