import { describe, expect, it } from "vitest";

import {
  isDesktopGoogleChrome,
  toChromeUrl,
} from "@/components/home/ChromeStartButton";

describe("ChromeStartButton helpers", () => {
  it("converts app URLs to Chrome URL schemes", () => {
    expect(toChromeUrl("http://localhost:3000/profile")).toBe(
      "googlechrome://localhost:3000/profile",
    );
    expect(toChromeUrl("https://communications-umber.vercel.app/profile")).toBe(
      "googlechromes://communications-umber.vercel.app/profile",
    );
  });

  it("detects desktop Google Chrome without treating Safari as Chrome", () => {
    expect(
      isDesktopGoogleChrome({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
      }),
    ).toBe(true);
    expect(
      isDesktopGoogleChrome({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
      }),
    ).toBe(false);
  });

  it("does not treat Edge as Google Chrome", () => {
    expect(
      isDesktopGoogleChrome({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
      }),
    ).toBe(false);
  });
});
