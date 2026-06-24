"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

type UserAgentDataBrand = {
  brand: string;
  version: string;
};

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    brands?: UserAgentDataBrand[];
  };
};

export function isDesktopGoogleChrome(
  navigatorLike: Pick<Navigator, "userAgent"> & {
    userAgentData?: { brands?: UserAgentDataBrand[] };
  },
): boolean {
  const brands = navigatorLike.userAgentData?.brands ?? [];
  if (brands.some((brand) => brand.brand === "Google Chrome")) {
    return true;
  }

  const userAgent = navigatorLike.userAgent;
  return (
    /\bChrome\//.test(userAgent) &&
    !/\b(CriOS|Edg|OPR|Opera|SamsungBrowser)\b/.test(userAgent)
  );
}

export function toChromeUrl(
  targetUrl: string,
  userAgent =
    typeof navigator !== "undefined" ? navigator.userAgent : "",
): string {
  const url = new URL(targetUrl);

  if (/iPhone|iPad|iPod/.test(userAgent)) {
    if (url.protocol === "http:") {
      return `googlechrome:${url.href.slice("http:".length)}`;
    }
    if (url.protocol === "https:") {
      return `googlechromes:${url.href.slice("https:".length)}`;
    }
  }

  if (/Android/.test(userAgent)) {
    return `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=${url.protocol.slice(
      0,
      -1,
    )};package=com.android.chrome;end`;
  }

  if (url.protocol === "http:") {
    return `google-chrome://${url.toString()}`;
  }
  if (url.protocol === "https:") {
    return `google-chrome://${url.toString()}`;
  }
  return targetUrl;
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
  const router = useRouter();

  function openProfile() {
    const profileUrl = new URL("/profile", window.location.href).toString();
    if (
      isDesktopGoogleChrome(navigator as NavigatorWithUserAgentData) ||
      window.location.protocol === "googlechrome:" ||
      window.location.protocol === "googlechromes:" ||
      window.location.protocol === "google-chrome:"
    ) {
      router.push("/profile");
      return;
    }

    window.location.href = toChromeUrl(profileUrl, navigator.userAgent);
  }

  return (
    <button
      type="button"
      onClick={openProfile}
      className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
    >
      <ChromeMark />
      Chromeで始める
      <ArrowRight className="h-4 w-4" aria-hidden />
    </button>
  );
}
