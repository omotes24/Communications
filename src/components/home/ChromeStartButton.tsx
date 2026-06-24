"use client";

import { ArrowRight } from "lucide-react";
import { type MouseEvent } from "react";

const PROFILE_PATH = "/profile";

type UserAgentDataBrand = {
  brand: string;
};

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    brands?: UserAgentDataBrand[];
  };
};

export function isMobileUserAgent(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|CriOS|FxiOS|EdgiOS/i.test(userAgent);
}

export function isDesktopGoogleChrome(
  navigatorLike: Pick<Navigator, "userAgent"> & {
    userAgentData?: { brands?: UserAgentDataBrand[] };
  },
): boolean {
  if (isMobileUserAgent(navigatorLike.userAgent)) {
    return false;
  }

  const brands = navigatorLike.userAgentData?.brands ?? [];
  if (brands.some((brand) => brand.brand === "Google Chrome")) {
    return true;
  }

  return (
    /\bChrome\//.test(navigatorLike.userAgent) &&
    !/\b(Edg|OPR|Opera|SamsungBrowser)\b/.test(navigatorLike.userAgent)
  );
}

export function toDesktopChromeUrl(targetUrl: string): string {
  return `google-chrome://${targetUrl}`;
}

export function getChromeStartHref(
  currentPageUrl?: string,
  userAgent = "",
): string {
  if (!currentPageUrl || isMobileUserAgent(userAgent)) {
    return PROFILE_PATH;
  }
  return toDesktopChromeUrl(new URL(PROFILE_PATH, currentPageUrl).toString());
}

function ChromeMark() {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex h-5 w-5 shrink-0 rounded-full shadow-sm ring-1 ring-white/40"
      style={{
        background:
          "conic-gradient(#ea4335 0deg 115deg, #fbbc05 115deg 240deg, #34a853 240deg 360deg)",
      }}
    >
      <span className="absolute inset-[5px] rounded-full bg-[#4285f4] ring-2 ring-white" />
    </span>
  );
}

export function ChromeStartButton() {
  function openProfile(event: MouseEvent<HTMLAnchorElement>) {
    if (typeof window === "undefined") {
      return;
    }

    const userAgent = navigator.userAgent;
    if (
      isMobileUserAgent(userAgent) ||
      isDesktopGoogleChrome(navigator as NavigatorWithUserAgentData)
    ) {
      return;
    }

    event.preventDefault();
    window.location.href = getChromeStartHref(window.location.href, userAgent);
  }

  return (
    <a
      href={getChromeStartHref()}
      onClick={openProfile}
      className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
    >
      <ChromeMark />
      Chromeで始める
      <ArrowRight className="h-4 w-4" aria-hidden />
    </a>
  );
}
