import { describe, expect, it } from "vitest";

import {
  isDesktopGoogleChrome,
  toChromeUrl,
} from "@/components/home/ChromeStartButton";

describe("ChromeStartButton helpers", () => {
  it("converts desktop app URLs to the macOS Chrome URL scheme", () => {
    expect(toChromeUrl("http://localhost:3000/profile")).toBe(
      "google-chrome://navigate?url=http%3A%2F%2Flocalhost%3A3000%2Fprofile",
    );
    expect(toChromeUrl("https://communications-umber.vercel.app/profile")).toBe(
      "google-chrome://navigate?url=https%3A%2F%2Fcommunications-umber.vercel.app%2Fprofile",
    );
  });

  it("keeps iOS and Android Chrome launch URLs platform-specific", () => {
    expect(
      toChromeUrl(
        "https://communications-umber.vercel.app/profile",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("googlechromes://communications-umber.vercel.app/profile");
    expect(
      toChromeUrl(
        "https://communications-umber.vercel.app/profile?slot=me",
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe(
      "intent://communications-umber.vercel.app/profile?slot=me#Intent;scheme=https;package=com.android.chrome;end",
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
