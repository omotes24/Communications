import { afterEach, describe, expect, it } from "vitest";

import { getAdminOwnerUserId, isAdminUser } from "@/lib/auth/admin";

const ownerId = "12345678-1234-4abc-8def-1234567890ab";
const owner = {
  id: ownerId,
  email: "kotaro3150@keio.jp",
  source: "supabase" as const,
};

describe("owner-only administrator authorization", () => {
  afterEach(() => {
    delete process.env.ADMIN_USER_IDS;
    delete process.env.ADMIN_EMAILS;
    delete process.env.LOCAL_AUTH_BYPASS;
    delete process.env.XYZ_KEY;
  });

  it("requires the sole configured UUID and the owner email together", () => {
    process.env.ADMIN_USER_IDS = ownerId;

    expect(getAdminOwnerUserId()).toBe(ownerId);
    expect(isAdminUser(owner)).toBe(true);
    expect(
      isAdminUser({ ...owner, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
    ).toBe(false);
    expect(isAdminUser({ ...owner, email: "collaborator@example.com" })).toBe(
      false,
    );
  });

  it("fails closed for missing, malformed, or multiple UUID values", () => {
    expect(isAdminUser(owner)).toBe(false);

    process.env.ADMIN_USER_IDS = "not-a-uuid";
    expect(isAdminUser(owner)).toBe(false);

    process.env.ADMIN_USER_IDS = `${ownerId},aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
    expect(isAdminUser(owner)).toBe(false);
  });

  it("never grants access through the retired email list or local bypass", () => {
    process.env.ADMIN_USER_IDS = ownerId;
    process.env.ADMIN_EMAILS = "kotaro3150@keio.jp";
    process.env.LOCAL_AUTH_BYPASS = "true";

    expect(isAdminUser({ ...owner, source: "local-dev" })).toBe(false);
    expect(isAdminUser({ ...owner, source: "test" })).toBe(false);
  });

  it("does not treat a fake XYZ value as authorization", () => {
    process.env.ADMIN_USER_IDS = ownerId;
    process.env.XYZ_KEY = "anything";

    expect(
      isAdminUser({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        email: "kotaro3150@keio.jp",
        source: "supabase",
      }),
    ).toBe(false);
  });

  it("normalizes case and surrounding whitespace", () => {
    process.env.ADMIN_USER_IDS = `  ${ownerId.toUpperCase()}  `;

    expect(
      isAdminUser({
        id: ownerId.toUpperCase(),
        email: "  KOTARO3150@KEIO.JP ",
        source: "supabase",
      }),
    ).toBe(true);
  });
});
