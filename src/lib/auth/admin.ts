import "server-only";

import { getCurrentUser, type AuthenticatedUser } from "@/lib/auth/server";
import { privateJson } from "@/lib/privacy/private-response";

/**
 * 経営管理情報は単一オーナーだけに許可する。
 * UUIDと確認済みメールアドレスの両方が一致しなければfail-closedにする。
 */
const ADMIN_OWNER_EMAIL = "kotaro3150@keio.jp";
export const ADMIN_ACCESS_DENIED_MESSAGE = "XYZキーが必要です。";
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
  if (!user || user.source !== "supabase" || !ownerUserId || !user.email) {
    return false;
  }

  return (
    user.id.trim().toLowerCase() === ownerUserId &&
    user.email.trim().toLowerCase() === ADMIN_OWNER_EMAIL
  );
}

async function getCurrentUserFailClosed(): Promise<AuthenticatedUser | null> {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

export async function getAdminUser(): Promise<AuthenticatedUser | null> {
  const user = await getCurrentUserFailClosed();
  if (!isAdminUser(user)) {
    return null;
  }
  return user;
}

export async function requireAdminApiUser(): Promise<
  { ok: true; user: AuthenticatedUser } | { ok: false; response: Response }
> {
  const user = await getCurrentUserFailClosed();
  if (!isAdminUser(user)) {
    // XYZは案内用の固定文言であり、キー入力や権限昇格の仕組みは存在しない。
    return {
      ok: false,
      response: privateJson(
        { error: ADMIN_ACCESS_DENIED_MESSAGE },
        { status: 403 },
      ),
    };
  }
  return { ok: true, user: user! };
}
