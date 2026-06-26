import { beforeEach, describe, expect, it, vi } from "vitest";
import { type NextRequest } from "next/server";

const authMocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: authMocks,
  })),
}));

import { GET as callbackGET } from "@/app/auth/callback/route";
import { GET as confirmGET } from "@/app/auth/confirm/route";

function request(url: string): NextRequest {
  return new Request(url) as NextRequest;
}

describe("auth confirmation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    authMocks.verifyOtp.mockResolvedValue({ error: null });
  });

  it("exchanges PKCE codes and redirects to the default profile page", async () => {
    const response = await confirmGET(
      request("https://communications-umber.vercel.app/auth/confirm?code=abc"),
    );

    expect(authMocks.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.headers.get("location")).toBe(
      "https://communications-umber.vercel.app/profile",
    );
  });

  it("verifies token hash confirmation links and respects safe next paths", async () => {
    const response = await confirmGET(
      request(
        "https://communications-umber.vercel.app/auth/confirm?token_hash=hash&type=email&next=/account",
      ),
    );

    expect(authMocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash",
      type: "email",
    });
    expect(response.headers.get("location")).toBe(
      "https://communications-umber.vercel.app/account",
    );
  });

  it("redirects recovery links to the password reset page", async () => {
    const response = await confirmGET(
      request(
        "https://communications-umber.vercel.app/auth/confirm?token_hash=hash&type=recovery&next=/account",
      ),
    );

    expect(authMocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash",
      type: "recovery",
    });
    expect(response.headers.get("location")).toBe(
      "https://communications-umber.vercel.app/auth/reset-password",
    );
  });

  it("keeps old password reset code links off the protected account page", async () => {
    const response = await confirmGET(
      request(
        "https://communications-umber.vercel.app/auth/confirm?code=abc&next=/account",
      ),
    );

    expect(authMocks.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.headers.get("location")).toBe(
      "https://communications-umber.vercel.app/auth/reset-password",
    );
  });

  it("falls back to the profile page for unsafe next paths", async () => {
    const response = await confirmGET(
      request(
        "https://communications-umber.vercel.app/auth/confirm?code=abc&next=https://evil.example",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://communications-umber.vercel.app/profile",
    );
  });

  it("keeps the legacy callback route compatible", async () => {
    const response = await callbackGET(
      request("https://communications-umber.vercel.app/auth/callback?code=abc"),
    );

    expect(authMocks.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.headers.get("location")).toBe(
      "https://communications-umber.vercel.app/profile",
    );
  });

  it("redirects to login when confirmation is missing or invalid", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValue({
      error: new Error("invalid code"),
    });

    const response = await confirmGET(
      request("https://communications-umber.vercel.app/auth/confirm?code=bad"),
    );

    expect(response.headers.get("location")).toBe(
      "https://communications-umber.vercel.app/auth/login?auth_callback=failed",
    );
  });
});
