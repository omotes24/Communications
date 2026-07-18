import "server-only";

import { maskSensitiveText } from "@/lib/privacy/logging";

function appendVary(headers: Headers, value: string): void {
  const current = headers.get("Vary");
  const values = (current ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!values.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
    values.push(value);
  }
  headers.set("Vary", values.join(", "));
}

export function privateNoStoreHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  appendVary(headers, "Cookie");
  return headers;
}

export function privateJson(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: privateNoStoreHeaders(init?.headers),
  });
}

export function privateJsonError(message: string, status = 400): Response {
  return privateJson({ error: maskSensitiveText(message) }, { status });
}
