import { describe, expect, it } from "vitest";

import { isAuthThrottleError, translateAuthError } from "@/lib/auth/errors";

describe("auth error translation", () => {
  it("detects provider throttle errors", () => {
    expect(isAuthThrottleError("rate limit exceeded")).toBe(true);
    expect(isAuthThrottleError("Too many requests")).toBe(true);
    expect(
      isAuthThrottleError(
        "For security purposes, you can only request this after 60 seconds.",
      ),
    ).toBe(true);
  });

  it("does not show wait-and-retry copy for provider rate limits", () => {
    const message = translateAuthError("rate limit exceeded");

    expect(message).not.toContain("短時間に操作が集中しています");
    expect(message).not.toContain("時間をおいて");
    expect(message).not.toContain("再度お試しください");
    expect(message).toBe("認証処理に失敗しました。入力内容を確認してください。");
  });

  it("keeps Supabase security-throttle text out of the UI", () => {
    const message = translateAuthError(
      "For security purposes, you can only request this after 60 seconds.",
    );

    expect(message).not.toContain("security purposes");
    expect(message).not.toContain("60 seconds");
    expect(message).not.toContain("時間をおいて");
    expect(message).toBe("認証処理に失敗しました。入力内容を確認してください。");
  });
});
