"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PasswordUpdateForm } from "@/components/auth/PasswordUpdateForm";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function recoveryErrorMessage(): string {
  return "再設定リンクを確認できませんでした。再設定メールをもう一度送信してください。";
}

export function ResetPasswordPanel() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function prepareRecoverySession() {
      if (!supabase) {
        setError("Supabaseの公開設定が不足しています。");
        setLoading(false);
        return;
      }

      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        const hashParams = new URLSearchParams(
          window.location.hash.replace(/^#/u, ""),
        );
        const hashError =
          hashParams.get("error_description") ?? hashParams.get("error");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (hashError) {
          throw new Error(hashError);
        }

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }
        } else if (tokenHash && type === "recovery") {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (verifyError) {
            throw verifyError;
          }
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) {
            throw sessionError;
          }
        } else {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) {
            throw new Error("missing recovery session");
          }
        }

        window.history.replaceState(null, "", "/auth/reset-password");
        if (!cancelled) {
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setError(recoveryErrorMessage());
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void prepareRecoverySession();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <section className="mx-auto max-w-md rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06]">
      <h1 className="text-3xl font-semibold tracking-tight">
        パスワード再設定
      </h1>
      <p className="mt-3 text-sm font-medium leading-7 text-[#6e6e73]">
        メール内の再設定リンクを確認してから、新しいパスワードを設定します。
      </p>

      {loading ? (
        <p className="mt-6 rounded-2xl bg-[#f5f5f7] px-4 py-3 text-sm font-semibold text-[#6e6e73]">
          再設定リンクを確認しています。
        </p>
      ) : null}

      {error ? (
        <div className="mt-6 grid gap-4">
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </p>
          <Link
            href="/auth/forgot-password"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#1d1d1f] px-5 text-sm font-semibold text-white"
          >
            再設定メールを送り直す
          </Link>
        </div>
      ) : null}

      {ready ? (
        <div className="mt-6">
          <PasswordUpdateForm />
        </div>
      ) : null}
    </section>
  );
}
