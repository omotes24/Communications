import { z } from "zod";

import { toPublicError } from "@/lib/privacy/logging";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const checkEmailRequestSchema = z.object({
  email: z.string().trim().email(),
});

const usersPageSize = 1000;
const maxUserPagesToScan = 50;

export async function POST(request: Request): Promise<Response> {
  try {
    const body = checkEmailRequestSchema.parse(await request.json());
    const exists = await authEmailExists(body.email);
    return Response.json({ exists });
  } catch (error) {
    return Response.json(
      { error: toPublicError(error) },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}

async function authEmailExists(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = createSupabaseServiceClient();

  for (let page = 1; page <= maxUserPagesToScan; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: usersPageSize,
    });
    if (error) {
      throw error;
    }

    const users = data.users ?? [];
    if (
      users.some((user) => user.email?.trim().toLowerCase() === normalizedEmail)
    ) {
      return true;
    }
    if (users.length < usersPageSize) {
      return false;
    }
  }

  throw new Error("ユーザー確認に失敗しました。");
}
