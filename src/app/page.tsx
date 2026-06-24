import Link from "next/link";
import { ArrowRight, Languages } from "lucide-react";

import { TypingHeadline } from "@/components/home/TypingHeadline";
import { AppShell } from "@/components/layout/AppShell";
import { getCompanyInputCopy } from "@/lib/company-input-mode";

export default function Home() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Yell for You 1.2";
  const companyInputCopy = getCompanyInputCopy();
  const steps = [
    {
      href: "/profile",
      title: "自分のプロフィールを入力",
      action: "Profile",
    },
    {
      href: "/company",
      title: "会社/面接の情報を入力する",
      action: "Company",
    },
    {
      href: "/support",
      title: "面接を録音し回答をOutputする",
      action: "Interview",
    },
  ];

  return (
    <AppShell>
      <section className="grid gap-8">
        <div className="py-10 text-center sm:py-16 lg:py-20">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            {appName}
          </p>
          <TypingHeadline />
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-8 text-[#6e6e73]">
            {companyInputCopy.homeLead}
            <br />
            瞬時に面接で回答する文章を生成します。
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/profile"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
            >
              はじめる
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/support"
              className="inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-semibold text-[#1d1d1f] shadow-sm ring-1 ring-black/[0.08] transition hover:bg-[#fdfdfd]"
            >
              面接へ
            </Link>
            <Link
              href="/english-interview"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#8b5e34] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6f4726]"
            >
              <Languages className="h-4 w-4" aria-hidden />
              英語面接
            </Link>
          </div>
        </div>

        <aside className="grid gap-4 md:grid-cols-3">
          <h2 className="sr-only">Current Flow</h2>
          {steps.map((step) => (
            <Link
              key={step.href}
              href={step.href}
              className="group relative min-h-40 overflow-hidden rounded-[26px] border border-white/70 bg-white/70 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_24px_70px_rgba(0,0,0,0.1)]"
            >
              <span
                aria-hidden
                className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/55 to-transparent"
              />
              <div className="flex h-full flex-col justify-between gap-8">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                  {step.action}
                </p>
                <h3 className="max-w-[15rem] text-2xl font-semibold leading-tight tracking-tight text-[#1d1d1f]">
                  {step.title}
                </h3>
              </div>
            </Link>
          ))}
        </aside>
      </section>
    </AppShell>
  );
}
