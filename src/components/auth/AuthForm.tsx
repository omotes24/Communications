"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { translateAuthError } from "@/lib/auth/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "login" | "sign-up" | "forgot-password";

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

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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
    setError("");
    setMessage("");

    if (!supabase) {
      setError("Supabaseの公開設定が不足しています。仕組みページを確認してください。");
      return;
    }

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
        router.replace(searchParams.get("next") || "/profile");
        router.refresh();
        return;
      }

      if (mode === "sign-up") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) {
          throw signUpError;
        }
        setMessage("確認メールを送信しました。メール内のリンクを開いてください。");
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/account`,
        },
      );
      if (resetError) {
        throw resetError;
      }
      setMessage("再設定メールを送信しました。");
    } catch (authError) {
      setError(
        authError instanceof Error
          ? translateAuthError(authError.message)
          : "認証処理に失敗しました。",
      );
    } finally {
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
