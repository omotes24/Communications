import { redirect } from "next/navigation";

import { getServerSupabaseConfig } from "@/lib/supabase/server-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

function shouldUseTestAuth(): boolean {
  if (!process.env.TEST_AUTH_USER_ID) {
    return false;
  }
  if (process.env.NODE_ENV === "test") {
    return true;
  }
  return (
    process.env.NODE_ENV === "development" &&
    process.env.E2E_TEST_AUTH === "true" &&
    process.env.AI_MOCK_MODE === "true"
  );
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  if (shouldUseTestAuth()) {
    return {
      id: process.env.TEST_AUTH_USER_ID!,
      email: "test@example.com",
    };
  }

  if (!getServerSupabaseConfig()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
  };
}

export async function requireCurrentUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }
  return user;
}

export async function requireApiUser(): Promise<
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; response: Response }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json(
        { error: "ログインが必要です。" },
        { status: 401 },
      ),
    };
  }
  return { ok: true, user };
}
