"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const sessionKey = "yfy.analytics-session";

function getSessionId(): string {
  const current = window.sessionStorage.getItem(sessionKey);
  if (current) return current;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(sessionKey, created);
  return created;
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

export function ProductAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PRODUCT_ANALYTICS_ENABLED !== "true") return;

    void fetch("/api/analytics/event", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: "page_view",
        feature: featureForPath(pathname),
        pathGroup: normalizePathGroup(pathname),
        sessionId: getSessionId(),
        metadata: { source: "app" },
      }),
    }).catch(() => {
      // Analytics must never interrupt the product experience.
    });
  }, [pathname]);

  return null;
}
