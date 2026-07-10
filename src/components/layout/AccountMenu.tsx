"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  History,
  LogIn,
  LogOut,
  Settings,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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

export function AccountMenu({ tone = "light" }: { tone?: "light" | "dark" }) {
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

    const user = await supabase.auth
      .getUser()
      .then((response) => response.data.user)
      .catch(() => null);

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
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
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

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      {state.status === "authenticated" &&
      state.walletStatus === "ready" &&
      state.availableBalance !== null ? (
        <Link
          href="/account/usage"
          className="hidden rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] sm:inline-flex"
        >
          {state.availableBalance.toLocaleString()} tokens
        </Link>
      ) : null}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="account-settings-menu"
          aria-label="設定メニュー"
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
            tone === "dark"
              ? "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
              : "bg-white text-[#6e6e73] shadow-sm ring-1 ring-black/[0.06] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]",
          )}
        >
          <Settings className="h-4 w-4" aria-hidden />
        </button>

        {open ? (
          <div
            id="account-settings-menu"
            className="absolute right-0 top-full z-50 mt-3 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-3 text-[#1d1d1f] shadow-xl ring-1 ring-black/[0.08]"
          >
            <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase text-[#86868b]">
              設定
            </p>
            {state.status === "authenticated" ? (
              <>
                <p className="truncate px-3 pb-2 text-xs font-semibold text-[#6e6e73]">
                  {state.email ?? "Account"}
                </p>
                {state.walletStatus === "unavailable" ? (
                  <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                    トークン残高の取得に失敗しました。ログイン状態は有効です。
                  </p>
                ) : null}
                <div className="grid gap-1 text-sm font-semibold">
                  <Link
                    href="/account"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-[#f5f5f7]"
                  >
                    <UserRound className="h-4 w-4" aria-hidden />
                    アカウント設定
                  </Link>
                  <Link
                    href="/account/usage"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-[#f5f5f7]"
                  >
                    <History className="h-4 w-4" aria-hidden />
                    トークン利用
                  </Link>
                  <Link
                    href="/pricing"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-[#f5f5f7]"
                  >
                    <CreditCard className="h-4 w-4" aria-hidden />
                    トークン購入
                  </Link>
                  <Link
                    href="/account/privacy"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-[#f5f5f7]"
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                    データ設定
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    ログアウト
                  </button>
                </div>
              </>
            ) : (
              <div className="grid gap-1 text-sm font-semibold">
                <Link
                  href="/auth/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-[#f5f5f7]"
                >
                  <LogIn className="h-4 w-4" aria-hidden />
                  ログイン
                </Link>
                <Link
                  href="/auth/sign-up"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-[#f5f5f7]"
                >
                  <UserPlus className="h-4 w-4" aria-hidden />
                  新規登録
                </Link>
                <Link
                  href="/pricing"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-[#f5f5f7]"
                >
                  <CreditCard className="h-4 w-4" aria-hidden />
                  料金・トークン
                </Link>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {state.status === "loading" ? (
        <span
          className={cn(
            "hidden h-9 w-20 rounded-full sm:inline-flex",
            tone === "dark" ? "bg-white/10" : "bg-white/70",
          )}
          aria-label="ログイン状態を確認中"
        />
      ) : state.status === "anonymous" ? (
        <Link
          href="/auth/login"
          className="inline-flex h-9 items-center rounded-full bg-[#1d1d1f] px-4 text-xs font-semibold text-white"
        >
          Login
        </Link>
      ) : (
        <Link
          href="/account"
          aria-label={`ログイン中${state.email ? `: ${state.email}` : ""}`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-3 text-xs font-semibold text-white shadow-sm ring-1 ring-black/[0.08]"
        >
          <UserRound className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">ログイン中</span>
        </Link>
      )}
    </div>
  );
}
