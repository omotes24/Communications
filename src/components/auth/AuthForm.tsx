"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { isAuthThrottleError, translateAuthError } from "@/lib/auth/errors";
import {
  createSupabaseBrowserClient,
  createSupabasePasswordRecoveryClient,
} from "@/lib/supabase/client";

type AuthMode = "login" | "sign-up" | "forgot-password";
type AuthAttemptResult = {
  key: string;
  kind: "error" | "message";
  text: string;
};

type CheckEmailResponse = {
  exists?: boolean;
  error?: string;
};

function getAuthRedirectOrigin(): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) {
    return configuredSiteUrl.replace(/\/+$/, "");
  }
  return window.location.origin;
}

function buildAuthConfirmUrl(next?: string): string {
  const url = new URL("/auth/confirm", `${getAuthRedirectOrigin()}/`);
  if (next) {
    url.searchParams.set("next", next);
  }
  return url.toString();
}

const authCopy = {
  login: {
    title: "ログイン",
    description: "登録済みのメールアドレスでログインします。",
    button: "ログイン",
  },
  "sign-up": {
    title: "新規登録",
    description: "確認メールを受け取れるメールアドレスで登録してください。",
    button: "登録する",
  },
  "forgot-password": {
    title: "パスワード再設定",
    description: "再設定用リンクをメールで送信します。",
    button: "再設定メールを送る",
  },
} satisfies Record<AuthMode, { title: string; description: string; button: string }>;

function throttleSafeMessage(mode: AuthMode): string {
  if (mode === "sign-up") {
    return "確認メールを送信済みです。受信メールを確認してください。";
  }
  if (mode === "forgot-password") {
    return "再設定メールを送信済みです。受信メールを確認してください。";
  }
  return "メールアドレスまたはパスワードを確認してください。";
}

function createAuthAttemptKey(mode: AuthMode, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (mode === "forgot-password") {
    return `${mode}:${normalizedEmail}`;
  }
  return `${mode}:${normalizedEmail}:${password}`;
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submittingRef = useRef(false);
  const lastAttemptRef = useRef<AuthAttemptResult | null>(null);
  const copy = authCopy[mode];
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || submittingRef.current) {
      return;
    }

    const attemptKey = createAuthAttemptKey(mode, email, password);
    if (lastAttemptRef.current?.key === attemptKey) {
      if (lastAttemptRef.current.kind === "message") {
        setError("");
        setMessage(lastAttemptRef.current.text);
      } else {
        setMessage("");
        setError(lastAttemptRef.current.text);
      }
      return;
    }

    setError("");
    setMessage("");

    if (!supabase) {
      setError("Supabaseの公開設定が不足しています。仕組みページを確認してください。");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          throw signInError;
        }
        lastAttemptRef.current = null;
        window.dispatchEvent(new Event("yfy-auth-state-change"));
        router.replace(searchParams.get("next") || "/profile");
        router.refresh();
        return;
      }

      if (mode === "sign-up") {
        const checkResponse = await fetch("/api/auth/sign-up/check-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const checkData = (await checkResponse
          .json()
          .catch(() => null)) as CheckEmailResponse | null;
        if (!checkResponse.ok) {
          throw new Error(
            checkData?.error ?? "登録済みメールアドレスの確認に失敗しました。",
          );
        }
        if (checkData?.exists) {
          const existingAccountMessage =
            "このメールアドレスは既に登録されています。ログインまたはパスワード再設定を使ってください。";
          lastAttemptRef.current = {
            key: attemptKey,
            kind: "error",
            text: existingAccountMessage,
          };
          setError(existingAccountMessage);
          return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: buildAuthConfirmUrl(),
          },
        });
        if (signUpError) {
          throw signUpError;
        }
        const successMessage =
          "確認メールを送信しました。メール内のリンクを開いてください。";
        lastAttemptRef.current = {
          key: attemptKey,
          kind: "message",
          text: successMessage,
        };
        setMessage(successMessage);
        return;
      }

      const recoverySupabase = createSupabasePasswordRecoveryClient();
      const { error: resetError } =
        await recoverySupabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${getAuthRedirectOrigin()}/auth/reset-password`,
        });
      if (resetError) {
        throw resetError;
      }
      const successMessage = "再設定メールを送信しました。";
      lastAttemptRef.current = {
        key: attemptKey,
        kind: "message",
        text: successMessage,
      };
      setMessage(successMessage);
    } catch (authError) {
      if (authError instanceof Error && isAuthThrottleError(authError.message)) {
        const safeMessage = throttleSafeMessage(mode);
        lastAttemptRef.current = {
          key: attemptKey,
          kind: mode === "login" ? "error" : "message",
          text: safeMessage,
        };
        if (mode === "login") {
          setError(safeMessage);
          return;
        }
        setMessage(safeMessage);
        return;
      }

      const safeError =
        authError instanceof Error
          ? translateAuthError(authError.message)
          : "認証処理に失敗しました。";
      lastAttemptRef.current = {
        key: attemptKey,
        kind: "error",
        text: safeError,
      };
      setError(safeError);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06]">
      <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="mt-3 text-sm font-medium leading-7 text-[#6e6e73]">
        {copy.description}
      </p>

      <form onSubmit={submit} className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">
          メールアドレス
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 rounded-2xl border border-black/10 px-4 text-base outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-ring)]"
          />
        </label>

        {mode !== "forgot-password" ? (
          <label className="grid gap-2 text-sm font-semibold">
            パスワード
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 rounded-2xl border border-black/10 px-4 text-base outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-ring)]"
            />
          </label>
        ) : null}

        {error ? (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--accent)]">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="h-12 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "処理中..." : copy.button}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-[#6e6e73]">
        {mode !== "login" ? (
          <Link href="/auth/login" className="hover:text-[#1d1d1f]">
            ログインへ
          </Link>
        ) : null}
        {mode !== "sign-up" ? (
          <Link href="/auth/sign-up" className="hover:text-[#1d1d1f]">
            新規登録
          </Link>
        ) : null}
        {mode !== "forgot-password" ? (
          <Link href="/auth/forgot-password" className="hover:text-[#1d1d1f]">
            パスワード再設定
          </Link>
        ) : null}
      </div>
    </section>
  );
}
