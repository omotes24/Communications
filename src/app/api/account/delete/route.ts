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
    const { error } = await supabase.auth.admin.deleteUser(auth.user.id);
    if (error) {
      throw error;
    }
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(toPublicError(error), 400);
  }
}
