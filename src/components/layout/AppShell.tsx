"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Languages,
  MoreHorizontal,
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

const moreNavItems = [
  {
    href: "/company/intelligence",
    label: "複数の会社を比較する",
    icon: BarChart3,
  },
  {
    href: "/group-discussion",
    label: "グループディスカッション",
    icon: UsersRound,
  },
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
    for (const item of [...navItems, ...moreNavItems]) {
      router.prefetch(item.href);
    }
  }, [router]);

  function isNavItemActive(href: string) {
    if (href === "/company") {
      return displayedPathname === "/company";
    }
    return (
      displayedPathname === href ||
      (href !== "/" && displayedPathname.startsWith(`${href}/`))
    );
  }

  const moreActive = moreNavItems.some((item) => isNavItemActive(item.href));

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
      {tabsHidden ? (
        <button
          type="button"
          onClick={() => setTabsCollapsed(false)}
          aria-expanded={false}
          className={cn(
            "fixed right-2 top-3 z-40 inline-flex rounded-full px-2.5 py-3 text-xs font-semibold shadow-lg ring-1 [writing-mode:vertical-rl]",
            isDark
              ? "bg-neutral-950/90 text-white ring-white/10 hover:bg-neutral-900"
              : "bg-white/95 text-[#1d1d1f] ring-black/[0.08] hover:bg-[#f5f5f7]",
          )}
        >
          タブを表示
        </button>
      ) : (
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
                    onClick={() => setTabsCollapsed(true)}
                    aria-expanded
                    className={cn(
                      "inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold",
                      isDark
                        ? "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
                        : "bg-white text-[#6e6e73] shadow-sm ring-1 ring-black/[0.06] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]",
                    )}
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden />
                    <span className="hidden sm:inline">タブをしまう</span>
                  </button>
                ) : null}
                <AccountMenu />
              </div>
            </div>

            <nav
              aria-label="主要画面"
              className={cn(
                "relative z-30 mt-3 grid grid-cols-5 rounded-full p-1 shadow-sm ring-1",
                isDark
                  ? "bg-white/5 ring-white/10"
                  : "bg-white/75 ring-black/[0.06]",
              )}
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(item.href);
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
              <div className="group relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={moreActive}
                  className={cn(
                    "flex h-10 w-full items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold tracking-tight",
                    moreActive
                      ? isDark
                        ? "bg-white text-neutral-950 shadow-sm"
                        : "bg-[var(--accent)] text-white shadow-sm"
                      : isDark
                        ? "text-white/60 hover:bg-white/10 hover:text-white"
                        : "text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]",
                  )}
                >
                  <MoreHorizontal aria-hidden className="h-4 w-4 shrink-0" />
                  <span className="truncate">その他</span>
                  <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0" />
                </button>
                <div
                  role="menu"
                  className={cn(
                    "invisible absolute right-0 top-full z-50 min-w-64 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-3xl p-2 shadow-xl ring-1",
                      isDark
                        ? "bg-neutral-950 ring-white/10"
                        : "bg-white ring-black/[0.08]",
                    )}
                  >
                    {moreNavItems.map((item) => {
                      const Icon = item.icon;
                      const active = isNavItemActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch
                          role="menuitem"
                          onMouseEnter={() => router.prefetch(item.href)}
                          onFocus={() => router.prefetch(item.href)}
                          onPointerDown={() => markNavigationIntent(item.href)}
                          onClick={() => markNavigationIntent(item.href)}
                          className={cn(
                            "flex min-h-11 items-center gap-2 rounded-2xl px-3 text-sm font-semibold transition",
                            active
                              ? isDark
                                ? "bg-white text-neutral-950"
                                : "bg-[var(--accent)] text-white"
                              : isDark
                                ? "text-white/70 hover:bg-white/10 hover:text-white"
                                : "text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </nav>
          </div>
        </header>
      )}

      <div
        className={cn(
          "mx-auto max-w-6xl px-4 sm:px-6",
          tabsHidden ? "py-3 lg:py-4" : "py-8 lg:py-10",
        )}
      >
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
