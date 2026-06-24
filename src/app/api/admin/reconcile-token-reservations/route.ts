import { z } from "zod";

import { jsonError, toPublicError } from "@/lib/privacy/logging";
import { reconcileExpiredTokenReservations } from "@/lib/tokens/service";

export const dynamic = "force-dynamic";

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
  const secret = process.env.VERCEL_CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!secret || (bearer !== secret && headerSecret !== secret)) {
    return jsonError("認証に失敗しました。", 401);
  }

  try {
    const rawBody = request.method === "POST" ? await request.text() : "";
    const body = rawBody
      ? reconcileRequestSchema.catch({}).parse(JSON.parse(rawBody))
      : {};
    return Response.json(
      await reconcileExpiredTokenReservations(body.limit ?? 100),
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return jsonError(toPublicError(error), 400);
  }
}
