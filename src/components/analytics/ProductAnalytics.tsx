"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import {
  analyticsDisabledInThisBrowser,
  analyticsPreferenceEvent,
} from "@/lib/analytics/client-preferences";

const sessionKey = "yfy.analytics-session";
let memorySessionId: string | null = null;

function getSessionId(): string {
  try {
    const current = window.sessionStorage.getItem(sessionKey);
    if (current) return current;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(sessionKey, created);
    return created;
  } catch {
    memorySessionId ??= crypto.randomUUID();
    return memorySessionId;
  }
}

function normalizePathGroup(pathname: string): string {
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .slice(0, 5)
    .map((segment) =>
      /^[0-9a-f]{8,}(?:-[0-9a-f-]+)?$/i.test(segment) ? ":id" : segment,
    );
  return `/${segments.join("/")}` || "/";
}

function featureForPath(pathname: string): string {
  return pathname.split("/").filter(Boolean)[0] ?? "home";
}

function deviceCategory(): "mobile" | "tablet" | "desktop" | "unknown" {
  if (typeof window === "undefined") return "unknown";
  if (window.innerWidth < 768) return "mobile";
  if (window.innerWidth < 1100) return "tablet";
  return "desktop";
}

export function ProductAnalytics() {
  const pathname = usePathname();
  const lastRecordedPath = useRef<string | null>(null);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PRODUCT_ANALYTICS_ENABLED !== "true") return;

    const record = () => {
      if (pathname.startsWith("/admin")) return;
      if (analyticsDisabledInThisBrowser()) return;
      if (lastRecordedPath.current === pathname) return;
      lastRecordedPath.current = pathname;

      void fetch("/api/analytics/event", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: "page_view",
          feature: featureForPath(pathname),
          pathGroup: normalizePathGroup(pathname),
          sessionId: getSessionId(),
          deviceCategory: deviceCategory(),
          metadata: { source: "app" },
        }),
      }).catch(() => {
        // Analytics must never interrupt the product experience.
      });
    };

    record();
    window.addEventListener(analyticsPreferenceEvent, record);
    return () => window.removeEventListener(analyticsPreferenceEvent, record);
  }, [pathname]);

  return null;
}
