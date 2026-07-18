import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/components/auth/AuthForm";

const router = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

const recoveryAuthMocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: authMocks,
  }),
  createSupabasePasswordRecoveryClient: () => ({
    auth: recoveryAuthMocks,
  }),
}));

function getForm(buttonName: string) {
  const button = screen.getByRole("button", { name: buttonName });
  const form = button.closest("form");
  if (!form) {
    throw new Error("form not found");
  }
  return form;
}

function submitForm(buttonName: string) {
  fireEvent.submit(getForm(buttonName));
}

describe("AuthForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("sends only one login request while a login is pending", async () => {
    let resolveLogin: ((value: { error: Error | null }) => void) | undefined;
    authMocks.signInWithPassword.mockReturnValue(
      new Promise<{ error: Error | null }>((resolve) => {
        resolveLogin = resolve;
      }),
    );

    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });

    const form = getForm("ログイン");
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(authMocks.signInWithPassword).toHaveBeenCalledTimes(1);

    resolveLogin?.({ error: null });
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/profile");
    });
  });

  it("does not resend the same failed login credentials", async () => {
    authMocks.signInWithPassword.mockResolvedValue({
      error: new Error("Invalid login credentials"),
    });

    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "wrong-password" },
    });

    submitForm("ログイン");
    await screen.findByText(
      "メールアドレスまたはパスワードが正しくありません。",
    );

    submitForm("ログイン");
    expect(authMocks.signInWithPassword).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "changed-password" },
    });
    submitForm("ログイン");
    await waitFor(() => {
      expect(authMocks.signInWithPassword).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("button", { name: "ログイン" })).toBeEnabled();
    });
  });

  it("treats duplicate signup throttle responses as an already-sent email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ exists: false }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    authMocks.signUp.mockResolvedValue({
      error: new Error(
        "For security purposes, you can only request this after 60 seconds.",
      ),
    });

    render(<AuthForm mode="sign-up" />);
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });

    submitForm("登録する");
    await screen.findByText(
      "確認メールを送信済みです。受信メールを確認してください。",
    );

    submitForm("登録する");
    expect(authMocks.signUp).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(/受け付けられません|時間をおいて|再度お試し/),
    ).not.toBeInTheDocument();
  });

  it("uses the configured public site URL for signup confirmation emails", async () => {
    process.env.NEXT_PUBLIC_SITE_URL =
      "https://www.yell-for-you.jp/";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ exists: false }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    authMocks.signUp.mockResolvedValue({ error: null });

    render(<AuthForm mode="sign-up" />);
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });

    submitForm("登録する");
    await screen.findByText(
      "確認メールを送信しました。メール内のリンクを開いてください。",
    );

    expect(authMocks.signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "password123",
      options: {
        emailRedirectTo: "https://www.yell-for-you.jp/auth/confirm",
      },
    });
  });

  it("does not send a signup email when the email is already registered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ exists: true }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(<AuthForm mode="sign-up" />);
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "existing@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });

    submitForm("登録する");
    await screen.findByText(
      "このメールアドレスは既に登録されています。ログインまたはパスワード再設定を使ってください。",
    );

    expect(authMocks.signUp).not.toHaveBeenCalled();
  });

  it("sends password reset emails to the dedicated reset password page", async () => {
    process.env.NEXT_PUBLIC_SITE_URL =
      "https://www.yell-for-you.jp/";
    recoveryAuthMocks.resetPasswordForEmail.mockResolvedValue({ error: null });

    render(<AuthForm mode="forgot-password" />);
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "user@example.com" },
    });

    submitForm("再設定メールを送る");
    await screen.findByText("再設定メールを送信しました。");

    expect(authMocks.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(recoveryAuthMocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "user@example.com",
      {
        redirectTo:
          "https://www.yell-for-you.jp/auth/reset-password",
      },
    );
  });
});
