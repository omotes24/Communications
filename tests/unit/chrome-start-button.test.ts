import { describe, expect, it } from "vitest";

import {
  getChromeStartHref,
  isDesktopGoogleChrome,
  isMobileUserAgent,
  toDesktopChromeUrl,
} from "@/components/home/ChromeStartButton";

describe("ChromeStartButton helpers", () => {
  it("keeps the rendered link on the profile page for reliable mobile taps", () => {
    expect(getChromeStartHref()).toBe("/profile");
  });

  it("uses normal navigation on smartphones", () => {
    expect(
      getChromeStartHref(
        "https://www.yell-for-you.jp/",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/143.0.0.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("/profile");
    expect(
      getChromeStartHref(
        "https://www.yell-for-you.jp/",
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe("/profile");
  });

  it("opens desktop Safari and other desktop browsers through Chrome", () => {
    expect(
      getChromeStartHref(
        "https://www.yell-for-you.jp/company",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
      ),
    ).toBe("google-chrome://https://www.yell-for-you.jp/profile");
  });

  it("builds macOS Chrome launch URLs", () => {
    expect(toDesktopChromeUrl("https://www.yell-for-you.jp/profile")).toBe(
      "google-chrome://https://www.yell-for-you.jp/profile",
    );
  });

  it("detects mobile and desktop Chrome separately", () => {
    expect(
      isMobileUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/143.0.0.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);
    expect(
      isDesktopGoogleChrome({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
      }),
    ).toBe(true);
    expect(
      isDesktopGoogleChrome({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/143.0.0.0 Mobile/15E148 Safari/604.1",
      }),
    ).toBe(false);
  });
});
