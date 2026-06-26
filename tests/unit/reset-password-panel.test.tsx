import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResetPasswordPanel } from "@/components/auth/ResetPasswordPanel";

const authMocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getSession: vi.fn(),
  setSession: vi.fn(),
  updateUser: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: authMocks,
  }),
}));

describe("ResetPasswordPanel", () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("exchanges recovery codes and shows the password update form", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    window.history.pushState(null, "", "/auth/reset-password?code=abc");
    render(<ResetPasswordPanel />);

    await waitFor(() => {
      expect(authMocks.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    });
    expect(screen.getByLabelText("新しいパスワード")).toBeInTheDocument();
  });

  it("accepts hash sessions from Supabase recovery redirects", async () => {
    authMocks.setSession.mockResolvedValue({ error: null });

    window.history.pushState(
      null,
      "",
      "/auth/reset-password#access_token=access&refresh_token=refresh&type=recovery",
    );
    render(<ResetPasswordPanel />);

    await waitFor(() => {
      expect(authMocks.setSession).toHaveBeenCalledWith({
        access_token: "access",
        refresh_token: "refresh",
      });
    });
    expect(screen.getByLabelText("新しいパスワード")).toBeInTheDocument();
  });

  it("verifies recovery token hashes and shows the password update form", async () => {
    authMocks.verifyOtp.mockResolvedValue({ error: null });

    window.history.pushState(
      null,
      "",
      "/auth/reset-password?token_hash=hash&type=recovery",
    );
    render(<ResetPasswordPanel />);

    await waitFor(() => {
      expect(authMocks.verifyOtp).toHaveBeenCalledWith({
        token_hash: "hash",
        type: "recovery",
      });
    });
    expect(screen.getByLabelText("新しいパスワード")).toBeInTheDocument();
  });
});
