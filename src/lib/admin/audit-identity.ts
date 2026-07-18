import "server-only";

import { createHmac } from "node:crypto";

const MINIMUM_SECRET_BYTES = 32;

export function getAdminAuditHmacSecret(): string | null {
  const secret = process.env.ADMIN_AUDIT_HMAC_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < MINIMUM_SECRET_BYTES) {
    return null;
  }
  return secret;
}

export function adminAccountCode(value: string, secret: string): string {
  const digest = createHmac("sha256", secret).update(value).digest("hex");
  return `yfy_${digest.slice(0, 12)}`;
}
