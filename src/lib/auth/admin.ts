import "server-only";

import { getCurrentUser, type AuthenticatedUser } from "@/lib/auth/server";

/**
 * 管理者は変更されにくい Supabase Auth の user UUID で指定する。
 * ADMIN_EMAILS は既存環境から安全に移行するための互換設定として残す。
 */
export function getAdminUserIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
}

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

export function isAdminUser(user: AuthenticatedUser | null): boolean {
  if (!user) {
    return false;
  }

  const adminUserIds = getAdminUserIds();
  if (adminUserIds.includes(user.id.toLowerCase())) {
    return true;
  }

  // ADMIN_EMAILS は移行用。新しい管理者は ADMIN_USER_IDS へ登録する。
  if (user.email && getAdminEmails().includes(user.email.toLowerCase())) {
    return true;
  }

  return (
    isLocalDevBypass() &&
    adminUserIds.length === 0 &&
    getAdminEmails().length === 0
  );
}

export async function getAdminUser(): Promise<AuthenticatedUser | null> {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) {
    return null;
  }
  return user;
}

export async function requireAdminApiUser(): Promise<
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; response: Response }
> {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) {
    // 管理APIの存在を一般ユーザーへ知らせない。JobTrack と同じ fail-closed 方針。
    return {
      ok: false,
      response: Response.json({ error: "Not found" }, { status: 404 }),
    };
  }
  return { ok: true, user: user! };
}
