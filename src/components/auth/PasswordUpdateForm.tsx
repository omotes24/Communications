"use client";

import { useMemo, useRef, useState } from "react";

import { isAuthThrottleError, translateAuthError } from "@/lib/auth/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function PasswordUpdateForm() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const lastAttemptRef = useRef<
    { password: string; kind: "error" | "message"; text: string } | null
  >(null);
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

    if (lastAttemptRef.current?.password === password) {
      if (lastAttemptRef.current.kind === "message") {
        setError("");
        setMessage(lastAttemptRef.current.text);
      } else {
        setMessage("");
        setError(lastAttemptRef.current.text);
      }
      return;
    }

    setMessage("");
    setError("");

    if (!supabase) {
      setError("Supabaseの公開設定が不足しています。");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        throw updateError;
      }
      setPassword("");
      lastAttemptRef.current = {
        password,
        kind: "message",
        text: "パスワードを更新しました。",
      };
      setMessage("パスワードを更新しました。");
    } catch (authError) {
      if (authError instanceof Error && isAuthThrottleError(authError.message)) {
        const safeError =
          "パスワードを更新できませんでした。入力内容を確認してください。";
        lastAttemptRef.current = {
          password,
          kind: "error",
          text: safeError,
        };
        setError(safeError);
        return;
      }

      const safeError =
        authError instanceof Error
          ? translateAuthError(authError.message)
          : "更新に失敗しました。";
      lastAttemptRef.current = {
        password,
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
    <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-2 text-sm font-semibold">
        新しいパスワード
        <input
          type="password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 rounded-2xl border border-black/10 px-4 outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-ring)]"
        />
      </label>
      {message ? <p className="text-sm font-semibold text-[var(--accent)]">{message}</p> : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="h-11 rounded-full bg-[#1d1d1f] px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "更新中..." : "パスワードを更新"}
      </button>
    </form>
  );
}
