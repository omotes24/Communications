import { afterEach, describe, expect, it } from "vitest";

import {
  adminAccountCode,
  getAdminAuditHmacSecret,
} from "@/lib/admin/audit-identity";

describe("administrator audit identity", () => {
  afterEach(() => {
    delete process.env.ADMIN_AUDIT_HMAC_SECRET;
  });

  it("fails closed when the HMAC secret is missing or shorter than 32 bytes", () => {
    expect(getAdminAuditHmacSecret()).toBeNull();

    process.env.ADMIN_AUDIT_HMAC_SECRET = "too-short";
    expect(getAdminAuditHmacSecret()).toBeNull();
  });

  it("creates a stable pseudonym only with a sufficiently long secret", () => {
    const secret = "a".repeat(32);
    process.env.ADMIN_AUDIT_HMAC_SECRET = secret;

    expect(getAdminAuditHmacSecret()).toBe(secret);
    expect(adminAccountCode("private-user-id", secret)).toMatch(
      /^yfy_[0-9a-f]{12}$/,
    );
    expect(adminAccountCode("private-user-id", secret)).not.toContain(
      "private-user-id",
    );
    expect(adminAccountCode("private-user-id", secret)).not.toBe(
      adminAccountCode("private-user-id", "b".repeat(32)),
    );
  });
});
