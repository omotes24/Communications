import { z } from "zod";

import { requireApiUser } from "@/lib/auth/server";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import { appStorageSchema } from "@/lib/schemas/interview";
import { importLocalStorageOnce } from "@/lib/storage/cloud-store";

export const dynamic = "force-dynamic";

const importLocalStorageRequestSchema = z.object({
  storage: appStorageSchema,
  importId: z.string().trim().min(1),
  migrationVersion: z.string().trim().min(1),
});

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = importLocalStorageRequestSchema.parse(await request.json());
    return Response.json(
      await importLocalStorageOnce({
        userId: auth.user.id,
        storage: body.storage,
        importId: body.importId,
        migrationVersion: body.migrationVersion,
      }),
    );
  } catch (error) {
    return jsonError(toPublicError(error), 400);
  }
}
