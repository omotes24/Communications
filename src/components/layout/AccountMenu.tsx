"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AccountState =
  | { status: "loading" }
  | { status: "anonymous" }
  | {
      status: "authenticated";
      email: string | null;
      availableBalance: number | null;
      reservedBalance: number | null;
      walletStatus: "loading" | "ready" | "unavailable";
    };

export function AccountMenu() {
  const router = useRouter();
  const [state, setState] = useState<AccountState>({ status: "loading" });
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  const load = useCallback(async () => {
    if (!supabase) {
      setState({ status: "anonymous" });
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setState({ status: "anonymous" });
      return;
    }

    const fallbackEmail = user.email ?? null;
    setState({
      status: "authenticated",
      email: fallbackEmail,
      availableBalance: null,
      reservedBalance: null,
      walletStatus: "loading",
    });

    try {
      const response = await fetch("/api/account/me", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error("account_summary_unavailable");
      }
      const data = (await response.json()) as {
        email: string | null;
        wallet: { available_balance: number; reserved_balance: number };
      };
      setState({
        status: "authenticated",
        email: data.email ?? fallbackEmail,
        availableBalance: data.wallet.available_balance,
        reservedBalance: data.wallet.reserved_balance,
        walletStatus: "ready",
      });
    } catch {
      setState({
        status: "authenticated",
        email: fallbackEmail,
        availableBalance: null,
        reservedBalance: null,
        walletStatus: "unavailable",
      });
    }
  }, [supabase]);

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      void load();
    }, 0);
    window.addEventListener("focus", load);
    window.addEventListener("pageshow", load);
    window.addEventListener("yfy-auth-state-change", load);
    const subscription = supabase?.auth.onAuthStateChange(() => {
      void load();
    });
    return () => {
      window.clearTimeout(initialLoadTimer);
      window.removeEventListener("focus", load);
      window.removeEventListener("pageshow", load);
      window.removeEventListener("yfy-auth-state-change", load);
      subscription?.data.subscription.unsubscribe();
    };
  }, [load, supabase]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function logout() {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      setOpen(false);
      setState({ status: "anonymous" });
      window.dispatchEvent(new Event("yfy-auth-state-change"));
      router.replace("/auth/login");
      router.refresh();
    }
  }

  if (state.status === "loading") {
    return (
      <span className="hidden h-8 w-24 rounded-full bg-white/70 sm:inline-flex" />
    );
  }

  if (state.status === "anonymous") {
    return (
      <Link
        href="/auth/login"
        className="inline-flex h-9 items-center rounded-full bg-[#1d1d1f] px-4 text-xs font-semibold text-white"
      >
        Login
      </Link>
    );
  }

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      {state.walletStatus === "ready" && state.availableBalance !== null ? (
        <Link
          href="/account/usage"
          className="hidden rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] sm:inline-flex"
        >
          {state.availableBalance.toLocaleString()} tokens
        </Link>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="アカウントメニュー"
        className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-3 text-xs font-semibold text-white shadow-sm ring-1 ring-black/[0.08]"
      >
        <UserRound className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">ログイン中</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-3 w-64 rounded-[22px] bg-white p-3 shadow-lg ring-1 ring-black/[0.08]">
          <p className="truncate px-2 py-2 text-xs font-semibold text-[#6e6e73]">
            {state.email ?? "Account"}
          </p>
          {state.walletStatus === "unavailable" ? (
            <p className="mb-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
              トークン残高の取得に失敗しました。ログイン状態は有効です。
            </p>
          ) : null}
          <div className="grid gap-1 text-sm font-semibold">
            <Link
              href="/account"
              className="rounded-2xl px-3 py-2 hover:bg-[#f5f5f7]"
            >
              アカウント設定
            </Link>
            <Link
              href="/account/usage"
              className="rounded-2xl px-3 py-2 hover:bg-[#f5f5f7]"
            >
              トークン利用
            </Link>
            <Link
              href="/pricing"
              className="rounded-2xl px-3 py-2 hover:bg-[#f5f5f7]"
            >
              トークン購入
            </Link>
            <Link
              href="/account/privacy"
              className="rounded-2xl px-3 py-2 hover:bg-[#f5f5f7]"
            >
              データ設定
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 rounded-2xl px-3 py-2 text-left text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              ログアウト
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
