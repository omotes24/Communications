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
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-[#fbfbfd]/80 backdrop-blur-2xl">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="group flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-sm font-semibold tracking-tight text-white">
                QT
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-5 tracking-tight text-[#1d1d1f]">
                  QuestionTurbo
                </span>
                <span className="block truncate text-xs font-medium text-[#6e6e73]">
                  Japanese Interview Console
                </span>
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <span className="hidden rounded-full bg-[#e8f2ff] px-3 py-1.5 text-xs font-semibold text-[#0071e3] sm:inline-flex">
                AI READY
              </span>
              <Link
                href="/setup"
                aria-label="設定"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[#424245] shadow-sm ring-1 ring-black/[0.08] transition hover:bg-white hover:text-[#1d1d1f]"
              >
                <Settings className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          <nav
            aria-label="主要画面"
            className="mt-3 grid grid-cols-3 overflow-hidden rounded-full bg-white/75 p-1 shadow-sm ring-1 ring-black/[0.06]"
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
                      ? "bg-[#1d1d1f] text-white shadow-sm"
                      : "text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]",
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

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <main className="min-w-0">{children}</main>
        <footer className="mt-12 flex flex-wrap gap-5 border-t border-black/[0.08] pt-5 text-xs font-medium text-[#6e6e73]">
          <Link href="/history" className="hover:text-[#1d1d1f]">
            History
          </Link>
          <Link href="/privacy" className="hover:text-[#1d1d1f]">
            Privacy
          </Link>
          <Link href="/setup" className="hover:text-[#1d1d1f]">
            Setup
          </Link>
        </footer>
      </div>
    </div>
  );
}
