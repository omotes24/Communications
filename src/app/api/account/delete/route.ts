import { z } from "zod";

import { requireApiUser } from "@/lib/auth/server";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const deleteAccountSchema = z.object({
  confirmation: z.literal("DELETE"),
});

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    deleteAccountSchema.parse(await request.json());
    const supabase = createSupabaseServiceClient();
    await deleteStorageObjectsForUser(auth.user.id);
    const { error } = await supabase.auth.admin.deleteUser(auth.user.id);
    if (error) {
      throw error;
    }
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(toPublicError(error), 400);
  }
}

async function deleteStorageObjectsForUser(userId: string): Promise<void> {
  const buckets = (process.env.SUPABASE_STORAGE_BUCKETS ?? "")
    .split(",")
    .map((bucket) => bucket.trim())
    .filter(Boolean);

  if (buckets.length === 0) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  for (const bucket of buckets) {
    for (const prefix of [userId, `users/${userId}`]) {
      const files = await listStorageFiles(bucket, prefix);
      if (files.length > 0) {
        const { error: removeError } = await supabase.storage
          .from(bucket)
          .remove(files);
        if (removeError) {
          throw removeError;
        }
      }
    }
  }
}

async function listStorageFiles(
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
  });
  if (error) {
    throw error;
  }

  const files: string[] = [];
  for (const item of data ?? []) {
    if (!item.name) {
      continue;
    }
    const path = `${prefix}/${item.name}`;
    if (item.id) {
      files.push(path);
    } else {
      files.push(...(await listStorageFiles(bucket, path)));
    }
  }
  return files;
}
