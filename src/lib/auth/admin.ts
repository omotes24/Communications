import "server-only";

import { getCurrentUser, type AuthenticatedUser } from "@/lib/auth/server";
import { privateJson } from "@/lib/privacy/private-response";

/**
 * 経営管理情報は単一オーナーだけに許可する。
 * UUIDと確認済みメールアドレスの両方が一致しなければfail-closedにする。
 */
const ADMIN_OWNER_EMAIL = "kotaro3150@keio.jp";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getAdminOwnerUserId(): string | null {
  const configuredIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  if (configuredIds.length !== 1 || !UUID_PATTERN.test(configuredIds[0])) {
    return null;
  }
  return configuredIds[0];
}

export function isAdminUser(user: AuthenticatedUser | null): boolean {
  const ownerUserId = getAdminOwnerUserId();
  if (!user || !ownerUserId || !user.email) {
    return false;
  }

  return (
    user.id.trim().toLowerCase() === ownerUserId &&
    user.email.trim().toLowerCase() === ADMIN_OWNER_EMAIL
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
  { ok: true; user: AuthenticatedUser } | { ok: false; response: Response }
> {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) {
    // 管理APIの存在を一般ユーザーへ知らせない。JobTrack と同じ fail-closed 方針。
    return {
      ok: false,
      response: privateJson({ error: "Not found" }, { status: 404 }),
    };
  }
  return { ok: true, user: user! };
}
