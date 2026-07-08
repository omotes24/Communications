"use client";

import {
  BookOpenCheck,
  CheckCircle2,
  ImagePlus,
  MousePointerClick,
  Puzzle,
  RefreshCw,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ImageSolverCard } from "@/components/question-solver/ImageSolverCard";

const setupSteps = [
  {
    title: "拡張機能をONにする",
    body: "Chromeで chrome://extensions/ を開き、Yell for You Webテストを自動で解く をONにします。",
  },
  {
    title: "問題ページを開く",
    body: "Webテストや練習問題のページをChromeで開きます。問題文、選択肢、表が画面に表示されている状態にします。",
  },
  {
    title: "サイドパネルを開く",
    body: "Chrome右上の拡張機能アイコンから Yell for You Webテストを自動で解く を開きます。",
  },
  {
    title: "検知する",
    body: "サイドパネルの 検知 を押すと、開いているタブから問題を読み取り、解答を生成します。",
  },
];

const usageTips = [
  {
    icon: RefreshCw,
    title: "問題が変わったら再検知",
    body: "次の問題へ進んだ後は、再検知を押すと新しい問題を読み取ります。",
  },
  {
    icon: ImagePlus,
    title: "表やグラフは画像で補足",
    body: "表・グラフが読み取れない場合は、該当部分の画像をサイドパネルへ貼り付けて補足して解きます。",
  },
  {
    icon: MousePointerClick,
    title: "出力形式を切り替える",
    body: "解答のみ、解説、途中式を必要に応じて切り替えられます。",
  },
];

export function QuestionSolverScreen() {
  return (
    <div>
      <PageHeader
        title="Webテストを自動で解く"
        description="スクショ・画像の貼り付け、またはChrome拡張機能で問題を検知して解答を生成します。"
        descriptionClassName="text-[#1d1d1f]"
        compact
      />

      <section className="mb-4">
        <ImageSolverCard />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/[0.08]">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-white">
              <Puzzle className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                EXTENSION
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                Chrome拡張機能の使い方
              </h2>
            </div>
          </div>

          <div className="grid gap-3">
            {setupSteps.map((step, index) => (
              <div
                key={step.title}
                className="grid gap-3 rounded-3xl bg-[#f5f5f7] p-4 sm:grid-cols-[auto_minmax(0,1fr)]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#1d1d1f] shadow-sm ring-1 ring-black/[0.06]">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-[#1d1d1f]">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm font-medium leading-6 text-[#3f3f46]">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/[0.08]">
            <div className="mb-4 flex items-center gap-3">
              <BookOpenCheck
                className="h-5 w-5 text-[var(--accent)]"
                aria-hidden
              />
              <h2 className="text-xl font-semibold tracking-tight">
                使うときのポイント
              </h2>
            </div>
            <div className="grid gap-3">
              {usageTips.map((tip) => {
                const Icon = tip.icon;

                return (
                  <div
                    key={tip.title}
                    className="rounded-3xl bg-[#f5f5f7] p-4"
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        className="h-4 w-4 text-[var(--accent)]"
                        aria-hidden
                      />
                      <h3 className="text-sm font-semibold text-[#1d1d1f]">
                        {tip.title}
                      </h3>
                    </div>
                    <p className="mt-2 text-sm font-medium leading-6 text-[#3f3f46]">
                      {tip.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/[0.08]">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 text-emerald-600"
                aria-hidden
              />
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  問題文の手入力は不要です
                </h2>
                <p className="mt-2 text-sm font-medium leading-6 text-[#3f3f46]">
                  このページに画像を貼り付けるか、Chrome拡張機能のサイドパネルから検知・スクショ解答してください。どちらも問題文のタイピングやJSON貼り付けは不要です。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
