import { createHash, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { toPublicError } from "@/lib/privacy/logging";
import { privateJson } from "@/lib/privacy/private-response";
import { reconcileExpiredTokenReservations } from "@/lib/tokens/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const reconcileRequestSchema = z.object({
  limit: z.number().int().min(1).max(1000).optional(),
});

export async function GET(request: Request): Promise<Response> {
  return reconcile(request);
}

export async function POST(request: Request): Promise<Response> {
  return reconcile(request);
}

async function reconcile(request: Request): Promise<Response> {
  if (!hasValidCronAuthorization(request)) {
    return privateJson({ error: "認証に失敗しました。" }, { status: 401 });
  }

  try {
    const rawBody = request.method === "POST" ? await request.text() : "";
    const body = rawBody
      ? reconcileRequestSchema.catch({}).parse(JSON.parse(rawBody))
      : {};
    const result = await reconcileExpiredTokenReservations(body.limit ?? 100);
    return privateJson({ released: result.released });
  } catch (error) {
    return privateJson({ error: toPublicError(error) }, { status: 400 });
  }
}

function hasValidCronAuthorization(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!bearer) {
    return false;
  }

  const expected = createHash("sha256").update(secret).digest();
  const actual = createHash("sha256").update(bearer).digest();
  return timingSafeEqual(actual, expected);
}
