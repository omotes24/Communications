import { requireApiUser } from "@/lib/auth/server";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import { appStorageSchema, type AppStorage } from "@/lib/schemas/interview";
import { defaultStorage } from "@/lib/storage/browser-store";
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

type E2EStorageGlobal = typeof globalThis & {
  __YFY_E2E_APP_STORAGE__?: Map<string, AppStorage>;
};

function shouldUseE2EStorage(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.E2E_TEST_AUTH === "true" &&
    process.env.AI_MOCK_MODE === "true"
  );
}

function getE2EStorage(): Map<string, AppStorage> {
  const globalStore = globalThis as E2EStorageGlobal;
  globalStore.__YFY_E2E_APP_STORAGE__ ??= new Map<string, AppStorage>();
  return globalStore.__YFY_E2E_APP_STORAGE__;
}

export async function GET(): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    if (shouldUseE2EStorage()) {
      const storage = getE2EStorage().get(auth.user.id) ?? defaultStorage;
      return Response.json({
        storage,
        hasCloudData: storage !== defaultStorage,
        importedLocalStorage: false,
      });
    }
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
    if (shouldUseE2EStorage()) {
      getE2EStorage().set(auth.user.id, body.storage);
      return Response.json({ ok: true });
    }
    await saveCloudStorage(auth.user.id, body.storage, {
      allowEmptyOverwrite: body.allowEmptyOverwrite,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(toPublicError(error), 400);
  }
}
