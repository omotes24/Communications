import "server-only";

import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const supportedEmailOtpTypes = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function getSafeNextPath(value: string | null, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://app.local");
    if (parsed.origin !== "https://app.local") {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function getEmailOtpType(value: string | null): EmailOtpType | null {
  if (!value || !supportedEmailOtpTypes.has(value)) {
    return null;
  }
  return value as EmailOtpType;
}

function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url));
}

function redirectToAuthError(request: NextRequest): NextResponse {
  return redirectTo(request, "/auth/login?auth_callback=failed");
}

export async function completeAuthRedirect(
  request: NextRequest,
  fallbackNext = "/profile",
): Promise<NextResponse> {
  const url = new URL(request.url);
  const next = getSafeNextPath(url.searchParams.get("next"), fallbackNext);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = getEmailOtpType(url.searchParams.get("type"));
  const successNext =
    type === "recovery" || (code && next === "/account")
      ? "/auth/reset-password"
      : next;

  try {
    const supabase = await createSupabaseServerClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return redirectToAuthError(request);
      }
      return redirectTo(request, successNext);
    }

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });
      if (error) {
        return redirectToAuthError(request);
      }
      return redirectTo(request, successNext);
    }
  } catch {
    return redirectToAuthError(request);
  }

  return redirectToAuthError(request);
}
