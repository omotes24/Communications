import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  UserRound,
  UsersRound,
} from "lucide-react";

import { TypingHeadline } from "@/components/home/TypingHeadline";
import { AppShell } from "@/components/layout/AppShell";

const steps = [
  {
    href: "/profile",
    label: "1",
    title: "自分のプロフィールを入力",
    body: "経験、強み、弱み、話したい材料を整理する。",
    icon: UserRound,
  },
  {
    href: "/company",
    label: "2",
    title: "会社/面接の情報を入力する",
    body: "会社名、Webサイト、志望コースを登録する。",
    icon: BriefcaseBusiness,
  },
  {
    href: "/support",
    label: "3",
    title: "面接を録音し回答をOutputする",
    body: "質問を聞き取り、回答案を出力する。",
    icon: UsersRound,
  },
];

export default function Home() {
  return (
    <AppShell>
      <section className="grid gap-8">
        <div className="py-10 text-center sm:py-16 lg:py-20">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-[#0071e3]">
            QuestionTurbo
          </p>
          <TypingHeadline />
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-8 text-[#6e6e73]">
            自分の情報、会社名、企業Webサイト、志望コースを起点に、面接前の理解メモと回答案を作ります。
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/profile"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#0071e3] px-6 text-sm font-semibold text-white transition hover:bg-[#147ce5]"
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
          </div>
        </div>

        <aside className="grid gap-4 md:grid-cols-3">
          <h2 className="sr-only">Current Flow</h2>
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.href}
                href={step.href}
                className="group min-h-64 rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06] transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f5f7] text-sm font-semibold text-[#1d1d1f]">
                    {step.label}
                  </span>
                  <Icon className="h-5 w-5 text-[#0071e3]" aria-hidden />
                </div>
                <h3 className="mt-14 text-2xl font-semibold tracking-tight text-[#1d1d1f]">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm font-medium leading-6 text-[#6e6e73]">
                  {step.body}
                </p>
              </Link>
            );
          })}
        </aside>
      </section>
    </AppShell>
  );
}
