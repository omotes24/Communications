"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  History,
  Mic2,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/setup", label: "初期設定", icon: Settings },
  { href: "/profile", label: "ユーザー情報", icon: UserRound },
  { href: "/company", label: "企業・求人", icon: BriefcaseBusiness },
  { href: "/practice", label: "面接練習", icon: Mic2 },
  { href: "/support", label: "同意済み支援", icon: UsersRound },
  { href: "/history", label: "履歴", icon: History },
  { href: "/privacy", label: "削除・プライバシー", icon: ShieldCheck },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f5f7f8] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex min-w-0 flex-col">
            <span className="text-base font-semibold leading-6">
              日本語面接アシスタント
            </span>
            <span className="text-xs text-slate-500">
              練習・同意済み会話支援専用
            </span>
          </Link>
          <span className="rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
            AI支援利用中
          </span>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-0 px-5 py-5 lg:grid-cols-[240px_1fr] lg:gap-6">
        <nav
          aria-label="主要画面"
          className="mb-5 grid grid-cols-2 gap-2 lg:mb-0 lg:block"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "mb-1 flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-slate-950 text-white"
                    : "text-slate-700 hover:bg-white",
                )}
              >
                <Icon aria-hidden className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
