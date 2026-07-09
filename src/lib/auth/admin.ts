import "server-only";

import { getCurrentUser, type AuthenticatedUser } from "@/lib/auth/server";

/**
 * 管理者はメールアドレスで指定する。
 * 環境変数 ADMIN_EMAILS にカンマ区切りで設定（例: "a@example.com,b@example.com"）。
 * Vercelの環境変数から変更できるので、デプロイ権限を持つ人（友人）が管理できる。
 */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isLocalDevBypass(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.LOCAL_AUTH_BYPASS === "true"
  );
}

export function isAdminEmail(email: string | null): boolean {
  const admins = getAdminEmails();
  if (email && admins.includes(email.toLowerCase())) {
    return true;
  }
  // ローカル開発（認証バイパス中）でADMIN_EMAILS未設定なら管理者として扱い、
  // ダッシュボードを確認できるようにする。本番では必ずADMIN_EMAILSが必要。
  return isLocalDevBypass() && admins.length === 0;
}

export async function getAdminUser(): Promise<AuthenticatedUser | null> {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return null;
  }
  return user;
}

export async function requireAdminApiUser(): Promise<
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
  if (!isAdminEmail(user.email)) {
    return {
      ok: false,
      response: Response.json(
        { error: "管理者権限がありません。" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, user };
}
