import { describe, expect, it } from "vitest";

import { maskSensitiveText, toPublicError } from "@/lib/privacy/logging";

describe("privacy logging", () => {
  it("masks secrets and common personal identifiers", () => {
    const masked = maskSensitiveText(
      "key sk-proj-abcdefghijklmnopqrstuvwxyz012345 email test@example.com phone 090-1234-5678",
    );

    expect(masked).toContain("[MASKED_API_KEY]");
    expect(masked).toContain("[MASKED_EMAIL]");
    expect(masked).toContain("[MASKED_PHONE]");
    expect(masked).not.toContain("test@example.com");
  });

  it("explains provider quota errors without leaking raw provider text", () => {
    const message = toPublicError(
      new Error(
        "429 You exceeded your current quota, please check your plan and billing details.",
      ),
    );

    expect(message).toContain("AI API の利用枠または請求設定");
    expect(message).toContain("AI_MOCK_MODE=true");
    expect(message).not.toContain("You exceeded your current quota");
  });
});
