import { describe, expect, it } from "vitest";

import { translateAuthError } from "@/lib/auth/errors";

describe("auth error translation", () => {
  it("does not show the concentrated operations copy for provider rate limits", () => {
    const message = translateAuthError("rate limit exceeded");

    expect(message).not.toContain("短時間に操作が集中しています");
    expect(message).toBe(
      "認証処理を受け付けられませんでした。時間をおいて再度お試しください。",
    );
  });
});
