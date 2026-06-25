import { requireApiUser } from "@/lib/auth/server";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import { appStorageSchema } from "@/lib/schemas/interview";
import { loadCloudStorage, saveCloudStorage } from "@/lib/storage/cloud-store";
import { z } from "zod";

export const dynamic = "force-dynamic";

const storagePutRequestSchema = z.union([
  appStorageSchema.transform((storage) => ({
    storage,
    allowEmptyOverwrite: false,
  })),
  z.object({
    storage: appStorageSchema,
    allowEmptyOverwrite: z.boolean().optional().default(false),
  }),
]);

export async function GET(): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    return Response.json(await loadCloudStorage(auth.user.id));
  } catch (error) {
    return jsonError(toPublicError(error), 400);
  }
}

export async function PUT(request: Request): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = storagePutRequestSchema.parse(await request.json());
    await saveCloudStorage(auth.user.id, body.storage, {
      allowEmptyOverwrite: body.allowEmptyOverwrite,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(toPublicError(error), 400);
  }
}
