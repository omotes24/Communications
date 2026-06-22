import { describe, expect, it } from "vitest";

import { maskSensitiveText } from "@/lib/privacy/logging";

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
});
