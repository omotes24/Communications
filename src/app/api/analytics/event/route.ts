import { createHash, createHmac } from "node:crypto";

import { z } from "zod";

import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { requireApiUser } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";

export const runtime = "nodejs";

const analyticsEventSchema = z.object({
  eventName: z.enum([
    "page_view",
    "feature_open",
    "feature_complete",
    "feature_error",
    "checkout_started",
    "checkout_completed",
  ]),
  feature: z.string().trim().max(64).default(""),
  pathGroup: z
    .string()
    .trim()
    .max(160)
    .regex(/^\/[a-zA-Z0-9_:/-]*$/)
    .default("/"),
  sessionId: z.string().trim().min(8).max(100),
  outcome: z.enum(["success", "failed", "cancelled"]).optional(),
  durationMs: z.number().int().min(0).max(86_400_000).optional(),
  valueNumeric: z.number().finite().optional(),
  metadata: z
    .object({
      source: z.enum(["app", "checkout"]).optional(),
      planId: z.enum(["starter", "standard", "intensive"]).optional(),
      experimentKey: z.string().trim().max(64).optional(),
      variant: z.string().trim().max(64).optional(),
    })
    .strict()
    .optional(),
});

function sessionHash(userId: string, sessionId: string): string {
  const secret = process.env.ADMIN_AUDIT_HMAC_SECRET?.trim();
  const value = `${userId}:${sessionId}`;
  return secret
    ? createHmac("sha256", secret).update(value).digest("hex")
    : createHash("sha256").update(value).digest("hex");
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NEXT_PUBLIC_PRODUCT_ANALYTICS_ENABLED !== "true") {
    return new Response(null, { status: 204 });
  }

  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const rateLimit = checkRateLimit({
    key: `analytics:${auth.user.id}`,
    limit: 120,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.retryAfterSeconds);

  if (!getServerSupabaseConfig()?.serviceRoleKey) {
    return new Response(null, { status: 204 });
  }

  const parsed = analyticsEventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid analytics event" }, { status: 400 });
  }

  const event = parsed.data;
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("analytics_events").insert({
    user_id: auth.user.id,
    session_hash: sessionHash(auth.user.id, event.sessionId),
    event_name: event.eventName,
    feature: event.feature,
    path_group: event.pathGroup,
    outcome: event.outcome ?? null,
    duration_ms: event.durationMs ?? null,
    value_numeric: event.valueNumeric ?? null,
    metadata: event.metadata ?? {},
  });

  if (error) {
    return Response.json({ error: "Analytics unavailable" }, { status: 503 });
  }
  return new Response(null, { status: 202 });
}
