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
    label: "01",
    title: "自分を入れる",
    body: "サークル、開発経験、強み、弱みを貼る。",
    icon: UserRound,
  },
  {
    href: "/company",
    label: "02",
    title: "会社を作る",
    body: "会社名、Webサイト、志望コースからスロット化する。",
    icon: BriefcaseBusiness,
  },
  {
    href: "/support",
    label: "03",
    title: "面接で使う",
    body: "同意確認後、質問を入れて回答案を見る。",
    icon: UsersRound,
  },
];

export default function Home() {
  return (
    <AppShell>
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div className="border-b border-neutral-950 pb-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-red-600">
            QuestionTurbo
          </p>
          <TypingHeadline />
          <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-neutral-600">
            自分の情報、会社名、企業Webサイト、志望コースを起点に、面接前の理解メモと回答案を作ります。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/profile"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-neutral-950 px-6 text-sm font-semibold text-white transition hover:bg-red-600"
            >
              はじめる
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/support"
              className="inline-flex h-12 items-center rounded-full border border-neutral-950/15 bg-white px-6 text-sm font-semibold text-neutral-950 transition hover:border-neutral-950"
            >
              面接へ
            </Link>
          </div>
        </div>

        <aside className="rounded-[32px] border border-neutral-950 bg-neutral-950 p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-400">
            Current Flow
          </p>
          <div className="mt-5 grid gap-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <Link
                  key={step.href}
                  href={step.href}
                  className="group rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:border-white hover:bg-white hover:text-neutral-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-semibold text-red-400">
                      {step.label}
                    </span>
                    <Icon
                      className="h-5 w-5 text-neutral-500 group-hover:text-neutral-950"
                      aria-hidden
                    />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold tracking-tight">
                    {step.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-neutral-400 group-hover:text-neutral-600">
                    {step.body}
                  </p>
                </Link>
              );
            })}
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
