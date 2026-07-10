import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountMenu } from "@/components/layout/AccountMenu";

const router = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth }),
}));

describe("AccountMenu", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens account actions from settings instead of the login status", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { email: "user@example.com" } },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            email: "user@example.com",
            wallet: { available_balance: 1200, reserved_balance: 0 },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    render(<AccountMenu />);

    const accountStatus = await screen.findByRole("link", {
      name: "ログイン中: user@example.com",
    });
    expect(accountStatus).toHaveAttribute("href", "/account");
    expect(
      screen.queryByRole("link", { name: "アカウント設定" }),
    ).not.toBeInTheDocument();

    const settingsButton = screen.getByRole("button", { name: "設定メニュー" });
    fireEvent.click(settingsButton);

    expect(
      screen.getByRole("link", { name: "アカウント設定" }),
    ).toHaveAttribute("href", "/account");
    expect(settingsButton).toHaveAttribute("aria-expanded", "true");
  });

  it("shows login actions in settings for anonymous users", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });

    render(<AccountMenu />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "設定メニュー" }));

    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute(
      "href",
      "/auth/login",
    );
    expect(screen.getByRole("link", { name: "新規登録" })).toHaveAttribute(
      "href",
      "/auth/sign-up",
    );
  });

  it("falls back to the login action when auth state loading fails", async () => {
    auth.getUser.mockRejectedValue(new Error("network unavailable"));

    render(<AccountMenu />);

    expect(
      await screen.findByRole("link", { name: "Login" }),
    ).toBeInTheDocument();
  });
});
