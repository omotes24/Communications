"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Languages,
  UserRound,
  UsersRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { ThemeCustomizer } from "@/components/layout/ThemeCustomizer";
import { LocalStorageMigrationPrompt } from "@/components/storage/LocalStorageMigrationPrompt";

const navItems = [
  { href: "/profile", label: "自分", icon: UserRound },
  { href: "/company", label: "会社", icon: BriefcaseBusiness },
  { href: "/support", label: "面接", icon: UsersRound },
  { href: "/english-interview", label: "英語", icon: Languages },
];

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Yell for You 1.2";

export function AppShell({
  children,
  variant = "light",
}: {
  children: React.ReactNode;
  variant?: "light" | "dark";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [optimisticPathname, setOptimisticPathname] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const displayedPathname =
    optimisticPathname?.from === pathname ? optimisticPathname.to : pathname;
  const isDark = variant === "dark";
  const canCollapseTabs =
    displayedPathname === "/support" ||
    displayedPathname.startsWith("/support/") ||
    displayedPathname === "/english-interview" ||
    displayedPathname.startsWith("/english-interview/");
  const [tabsCollapsed, setTabsCollapsed] = useState(false);
  const tabsHidden = canCollapseTabs && tabsCollapsed;

  useEffect(() => {
    for (const item of navItems) {
      router.prefetch(item.href);
    }
  }, [router]);

  function markNavigationIntent(href: string) {
    if (href === displayedPathname) {
      return;
    }
    flushSync(() => {
      setOptimisticPathname({ from: pathname, to: href });
    });
  }

  return (
    <div
      className={cn(
        "min-h-screen",
        isDark ? "bg-[#050506] text-white" : "bg-[#f5f5f7] text-[#1d1d1f]",
      )}
    >
      <header
        className={cn(
          "sticky top-0 z-20 border-b backdrop-blur-2xl",
          isDark
            ? "border-white/10 bg-neutral-950/85"
            : "border-black/[0.06] bg-[#fbfbfd]/80",
        )}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              aria-label={`${appName} ホーム`}
              className="group flex min-w-0 items-center"
            >
              <span
                className={cn(
                  "truncate text-[22px] font-semibold tracking-normal transition group-hover:opacity-70 sm:text-[24px]",
                  isDark ? "text-white" : "text-[#1d1d1f]",
                )}
              >
                {appName}
              </span>
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              {canCollapseTabs ? (
                <button
                  type="button"
                  onClick={() => setTabsCollapsed((current) => !current)}
                  aria-expanded={!tabsHidden}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold",
                    isDark
                      ? "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
                      : "bg-white text-[#6e6e73] shadow-sm ring-1 ring-black/[0.06] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]",
                  )}
                >
                  {tabsHidden ? (
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  ) : (
                    <ChevronUp className="h-4 w-4" aria-hidden />
                  )}
                  <span className="hidden sm:inline">
                    {tabsHidden ? "タブを表示" : "タブをしまう"}
                  </span>
                </button>
              ) : null}
              <span
                className={cn(
                  "hidden rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex",
                  isDark
                    ? "bg-white/10 text-white/70"
                    : "bg-[var(--accent-soft)] text-[var(--accent)]",
                )}
              >
                AI READY
              </span>
              <AccountMenu />
            </div>
          </div>

          {!tabsHidden ? (
            <nav
              aria-label="主要画面"
              className={cn(
                "mt-3 grid grid-cols-4 overflow-hidden rounded-full p-1 shadow-sm ring-1",
                isDark
                  ? "bg-white/5 ring-white/10"
                  : "bg-white/75 ring-black/[0.06]",
              )}
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const active =
                  displayedPathname === item.href ||
                  (item.href !== "/" &&
                    displayedPathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    onMouseEnter={() => router.prefetch(item.href)}
                    onFocus={() => router.prefetch(item.href)}
                    onPointerDown={() => markNavigationIntent(item.href)}
                    onClick={() => markNavigationIntent(item.href)}
                    className={cn(
                      "flex h-10 items-center justify-center gap-2 rounded-full px-2 text-sm font-semibold tracking-tight",
                      active
                        ? isDark
                          ? "bg-white text-neutral-950 shadow-sm"
                          : "bg-[var(--accent)] text-white shadow-sm"
                        : isDark
                          ? "text-white/60 hover:bg-white/10 hover:text-white"
                          : "text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]",
                    )}
                  >
                    <Icon aria-hidden className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <main className="min-w-0">{children}</main>
        <footer
          className={cn(
            "mt-12 flex flex-wrap items-center gap-5 border-t pt-5 text-xs font-medium",
            isDark
              ? "border-white/10 text-white/50"
              : "border-black/[0.08] text-[#6e6e73]",
          )}
        >
          <Link
            href="/history"
            className={isDark ? "hover:text-white" : "hover:text-[#1d1d1f]"}
          >
            履歴
          </Link>
          <Link
            href="/pricing"
            className={isDark ? "hover:text-white" : "hover:text-[#1d1d1f]"}
          >
            課金
          </Link>
          <Link
            href="/terms"
            className={isDark ? "hover:text-white" : "hover:text-[#1d1d1f]"}
          >
            規約
          </Link>
          <Link
            href="/help"
            className={isDark ? "hover:text-white" : "hover:text-[#1d1d1f]"}
          >
            問い合わせ
          </Link>
          <Link
            href="/setup"
            className={isDark ? "hover:text-white" : "hover:text-[#1d1d1f]"}
          >
            仕組み
          </Link>
          <ThemeCustomizer tone={variant} />
        </footer>
      </div>
      <LocalStorageMigrationPrompt />
    </div>
  );
}
