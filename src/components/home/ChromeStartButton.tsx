"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

export function toChromeUrl(targetUrl: string): string {
  const url = new URL(targetUrl);
  if (url.protocol === "http:") {
    return `googlechrome:${url.href.slice("http:".length)}`;
  }
  if (url.protocol === "https:") {
    return `googlechromes:${url.href.slice("https:".length)}`;
  }
  return targetUrl;
}

export function ChromeStartButton() {
  const router = useRouter();
  const fallbackTimerRef = useRef<number | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) {
        window.clearTimeout(fallbackTimerRef.current);
      }
    };
  }, []);

  function openProfile() {
    setShowFallback(false);
    const profileUrl = new URL("/profile", window.location.href).toString();
    if (
      isDesktopGoogleChrome(navigator as NavigatorWithUserAgentData) ||
      window.location.protocol === "googlechrome:" ||
      window.location.protocol === "googlechromes:"
    ) {
      router.push("/profile");
      return;
    }

    window.location.href = toChromeUrl(profileUrl);
    if (fallbackTimerRef.current) {
      window.clearTimeout(fallbackTimerRef.current);
    }
    fallbackTimerRef.current = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        setShowFallback(true);
      }
    }, 1200);
  }

  function continueInCurrentBrowser() {
    setShowFallback(false);
    router.push("/profile");
  }

  return (
    <>
      <button
        type="button"
        onClick={openProfile}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
      >
        はじめる
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>

      {showFallback ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chromeで開く"
          className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-[28px] bg-white p-5 text-left shadow-2xl ring-1 ring-black/[0.08]">
            <h2 className="text-lg font-semibold tracking-tight text-[#1d1d1f]">
              Chromeで開けませんでした
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-[#6e6e73]">
              面接中の音声取得はChromeで動作します。Chromeを入れてから開くか、プロフィール入力だけ現在のブラウザで続けられます。
            </p>
            <div className="mt-5 grid gap-2">
              <a
                href="https://www.google.com/chrome/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-white"
              >
                Chromeをインストール
              </a>
              <button
                type="button"
                onClick={continueInCurrentBrowser}
                className="h-11 rounded-full bg-[#f5f5f7] px-4 text-sm font-semibold text-[#1d1d1f]"
              >
                このブラウザで自分を入力
              </button>
              <button
                type="button"
                onClick={() => setShowFallback(false)}
                className="h-10 text-sm font-semibold text-[#86868b]"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
