"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenCheck,
  BriefcaseBusiness,
  Languages,
  MessagesSquare,
  MoreHorizontal,
  UserRound,
  UsersRound,
} from "lucide-react";

import { AccountMenu } from "@/components/layout/AccountMenu";
import { ThemeCustomizer } from "@/components/layout/ThemeCustomizer";
import { LocalStorageMigrationPrompt } from "@/components/storage/LocalStorageMigrationPrompt";
import { ProductAnalytics } from "@/components/analytics/ProductAnalytics";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/profile", label: "自分", icon: UserRound },
  { href: "/company", label: "会社", icon: BriefcaseBusiness },
  { href: "/support", label: "面接", icon: UsersRound },
  { href: "/english-interview", label: "英語", icon: Languages },
];
const moreNavItems = [
  { href: "/group-discussion", label: "グループディスカッション", icon: MessagesSquare },
  { href: "/question-solver", label: "Webテストを自動で解く", icon: BookOpenCheck },
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
  const isDark = variant === "dark";
  const [intent, setIntent] = useState<{ from: string; to: string } | null>(null);
  const displayedPathname = intent?.from === pathname ? intent.to : pathname;
  const canCollapse = displayedPathname.startsWith("/support") || displayedPathname.startsWith("/english-interview");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    for (const item of [...navItems, ...moreNavItems]) router.prefetch(item.href);
  }, [router]);

  function active(href: string) {
    return displayedPathname === href || displayedPathname.startsWith(`${href}/`);
  }
  function navigate(href: string) {
    if (href === displayedPathname) return;
    flushSync(() => setIntent({ from: pathname, to: href }));
  }

  const moreActive = moreNavItems.some((item) => active(item.href));

  return (
    <div className={cn("relative isolate min-h-screen overflow-x-clip pb-28", isDark ? "bg-[#0d0d0f] text-white" : "bg-[#f5f5f7] text-[#1d1d1f]") }>
      <ProductAnalytics />
      <div className="app-aurora" aria-hidden="true"><span /><span /><span /></div>

      <header className="app-topbar sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-4 sm:px-8">
          <Link href="/" className="text-[17px] font-extrabold tracking-[-0.35px] transition-opacity hover:opacity-70" aria-label={`${appName} ホーム`}>
            {appName}
          </Link>
          <div className="flex items-center gap-2">
            {canCollapse ? (
              <button type="button" onClick={() => setCollapsed((value) => !value)} className="rounded-full bg-[var(--accent-light)] px-3 py-2 text-xs font-bold text-[var(--accent)]">
                {collapsed ? "タブを表示" : "集中表示"}
              </button>
            ) : null}
            <AccountMenu tone={variant} />
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-8 sm:py-8">
        <main className="min-w-0">{children}</main>
        <footer className={cn("mt-12 flex flex-wrap items-center gap-5 border-t pt-5 text-xs font-medium", isDark ? "border-white/10 text-white/50" : "border-black/[0.08] text-[#6e6e73]") }>
          <Link href="/history">履歴</Link><Link href="/pricing">課金</Link><Link href="/terms">規約</Link><Link href="/help">問い合わせ</Link><Link href="/setup">仕組み</Link><ThemeCustomizer tone={variant} />
        </footer>
      </div>

      {!collapsed ? (
        <nav aria-label="主要画面" className="jt-glass-bar fixed bottom-3 left-1/2 z-40 grid h-[70px] w-[calc(100%-24px)] max-w-[680px] -translate-x-1/2 grid-cols-5 gap-1 p-1.5 sm:bottom-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = active(item.href);
            return (
              <Link key={item.href} href={item.href} prefetch onPointerDown={() => navigate(item.href)} onClick={() => navigate(item.href)} className={cn("flex flex-col items-center justify-center rounded-xl text-[10px] font-bold transition sm:text-[11px]", selected ? "text-[var(--accent)]" : "text-[#66717d] hover:bg-white/30 hover:text-[#1d1d1f]") }>
                <span className={cn("mb-0.5 flex h-7 w-8 items-center justify-center rounded-[10px]", selected && "bg-[var(--accent-light)]") }><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
                {item.label}
              </Link>
            );
          })}
          <div className="group relative">
            <button type="button" aria-haspopup="menu" aria-expanded={moreActive} className={cn("flex h-full w-full flex-col items-center justify-center rounded-xl text-[10px] font-bold transition sm:text-[11px]", moreActive ? "text-[var(--accent)]" : "text-[#66717d] hover:bg-white/30 hover:text-[#1d1d1f]") }>
              <span className={cn("mb-0.5 flex h-7 w-8 items-center justify-center rounded-[10px]", moreActive && "bg-[var(--accent-light)]") }><MoreHorizontal className="h-[19px] w-[19px]" aria-hidden /></span>
              その他
            </button>
            <div className="invisible absolute bottom-full right-0 w-64 pb-3 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <div className="jt-floating-card grid gap-1 p-2">
                {moreNavItems.map((item) => {
                  const Icon = item.icon;
                  return <Link key={item.href} href={item.href} onClick={() => navigate(item.href)} className={cn("flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold", active(item.href) ? "bg-[var(--accent-light)] text-[var(--accent)]" : "text-[#6e6e73] hover:bg-black/[0.04]") }><Icon className="h-4 w-4" />{item.label}</Link>;
                })}
              </div>
            </div>
          </div>
        </nav>
      ) : null}
      <LocalStorageMigrationPrompt />
    </div>
  );
}
