import Link from "next/link";
import { Languages } from "lucide-react";

import { ChromeStartButton } from "@/components/home/ChromeStartButton";
import { AdminHomeLink } from "@/components/home/AdminHomeLink";
import { TypingHeadline } from "@/components/home/TypingHeadline";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default function Home() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Yell for You 1.3";

  return (
    <AppShell>
      <section className="grid gap-8">
        <div className="py-10 text-center sm:py-16 lg:py-20">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            {appName}
          </p>
          <TypingHeadline />
          <p className="mx-auto mt-6 max-w-5xl text-base font-medium leading-7 text-[#6e6e73] sm:text-lg sm:leading-8">
            LINEでリマインダー通知。(まもなく使用可能)
            <br className="sm:hidden" />
            面接前に自動で通知。
            <br />
            面接中は、あなたと応募先の情報をもとに、AIが回答案をリアルタイムで自動生成します。
          </p>
          <p className="mt-4 text-sm font-semibold text-[#86868b]">
            Chromeのみに対応しています。
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ChromeStartButton />
            <Link
              href="/support"
              className="inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-semibold text-[#1d1d1f] shadow-sm ring-1 ring-black/[0.08] transition hover:bg-[#fdfdfd]"
            >
              面接へ
            </Link>
            <Link
              href="/english-interview"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-on)] shadow-sm transition hover:bg-[var(--accent-hover)]"
            >
              <Languages className="h-4 w-4" aria-hidden />
              英語面接
            </Link>
            <AdminHomeLink />
          </div>
        </div>

        <div className="min-h-40 sm:min-h-48" aria-hidden />
      </section>
    </AppShell>
  );
}
