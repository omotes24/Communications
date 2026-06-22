"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  Settings,
  UserRound,
  UsersRound,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/profile", label: "自分", icon: UserRound },
  { href: "/company", label: "会社", icon: BriefcaseBusiness },
  { href: "/support", label: "面接", icon: UsersRound },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f4f4f1] text-neutral-950">
      <header className="sticky top-0 z-20 border-b border-neutral-950/10 bg-[#f4f4f1]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="group flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold tracking-tight text-white">
                QT
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-5 tracking-tight">
                  QuestionTurbo
                </span>
                <span className="block truncate text-xs font-medium text-neutral-500">
                  Japanese Interview Console
                </span>
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-700 sm:inline-flex">
                AI READY
              </span>
              <Link
                href="/setup"
                aria-label="設定"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-950/10 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-950 hover:text-neutral-950"
              >
                <Settings className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          <nav
            aria-label="主要画面"
            className="mt-4 grid grid-cols-3 overflow-hidden rounded-full border border-neutral-950/10 bg-white p-1 shadow-sm"
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
                    "flex h-10 items-center justify-center gap-2 rounded-full px-2 text-sm font-semibold tracking-tight transition",
                    active
                      ? "bg-neutral-950 text-white shadow-sm"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950",
                  )}
                >
                  <Icon aria-hidden className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <main className="min-w-0">{children}</main>
        <footer className="mt-12 flex flex-wrap gap-5 border-t border-neutral-950/10 pt-5 text-xs font-medium text-neutral-500">
          <Link href="/history" className="hover:text-neutral-950">
            History
          </Link>
          <Link href="/privacy" className="hover:text-neutral-950">
            Privacy
          </Link>
          <Link href="/setup" className="hover:text-neutral-950">
            Setup
          </Link>
        </footer>
      </div>
    </div>
  );
}
