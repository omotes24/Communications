import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Languages,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";

import { ChromeStartButton } from "@/components/home/ChromeStartButton";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { getCompanyInputCopy } from "@/lib/company-input-mode";

const steps = [
  {
    label: "自分を登録",
    detail: "経験と強みを準備",
    href: "/profile",
    icon: UserRound,
  },
  {
    label: "企業を登録",
    detail: "会社・求人を整理",
    href: "/company",
    icon: BriefcaseBusiness,
  },
  {
    label: "面接を開始",
    detail: "回答案をリアルタイム生成",
    href: "/support",
    icon: UsersRound,
  },
];

export default function Home() {
  const companyInputCopy = getCompanyInputCopy();

  return (
    <AppShell>
      <PageHeader
        title="面接準備を、ひとつずつ。"
        description={`${companyInputCopy.homeLead} 面接中は登録内容をもとに回答案をすばやく生成します。`}
      />

      <section className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.href}
                href={step.href}
                className="jt-card group flex min-h-28 items-center gap-4 p-4"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-light)] text-[var(--accent)]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="text-[10px] font-extrabold tracking-[0.2em] text-[#8e8e93]">
                    STEP {index + 1}
                  </span>
                  <span className="mt-1 block text-[15px] font-extrabold tracking-[-0.2px]">
                    {step.label}
                  </span>
                  <span className="mt-1 block text-xs text-[#6e6e73]">
                    {step.detail}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        <div className="jt-card grid overflow-hidden lg:grid-cols-[1.35fr_0.65fr]">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35px] text-[var(--accent)]">
              Next action
            </p>
            <h2 className="mt-2 text-[24px] font-extrabold tracking-[-0.7px] sm:text-[28px]">
              プロフィールを整えて、面接を始める
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6e6e73]">
              自分の情報と応募先を先に登録すると、面接中の回答案が具体的になります。Chromeデスクトップ版に対応しています。
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <ChromeStartButton />
              <Link
                href="/support"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#1d1d1f] ring-1 ring-black/[0.1]"
              >
                面接へ
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/english-interview"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--accent-light)] px-5 text-sm font-bold text-[var(--accent)]"
              >
                <Languages className="h-4 w-4" />
                英語面接
              </Link>
            </div>
          </div>
          <div className="flex min-h-48 items-center justify-center border-t border-black/[0.06] bg-[var(--accent-soft)] p-8 lg:border-l lg:border-t-0">
            <div className="text-center">
              <span className="accent-shadow mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[var(--accent)] text-white">
                <Sparkles className="h-7 w-7" />
              </span>
              <p className="mt-4 text-sm font-extrabold">
                AI Interview Copilot
              </p>
              <p className="mt-1 text-xs leading-5 text-[#6e6e73]">
                必要なときだけAIを使い
                <br />
                トークン原価を最適化
              </p>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
