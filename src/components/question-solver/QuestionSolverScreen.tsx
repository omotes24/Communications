"use client";

import {
  BookOpenCheck,
  CheckCircle2,
  Download,
  ImagePlus,
  MousePointerClick,
  Puzzle,
  RefreshCw,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";

const setupSteps = [
  {
    title: "拡張機能をダウンロード",
    body: "下の「拡張機能をダウンロード」からZIPを保存し、フォルダに展開します。",
  },
  {
    title: "Chromeで読み込む",
    body: "chrome://extensions/ を開き、右上の「デベロッパーモード」をON。「パッケージ化されていない拡張機能を読み込む」から展開したフォルダを選びます。",
  },
  {
    title: "サイドパネルを開く",
    body: "Chrome右上の拡張機能アイコンから SolveSnap を開きます。",
  },
  {
    title: "問題を解く",
    body: "画面をドラッグして問題部分を選び「解く」を押すか、「ページ検知」に切り替えて自動で問題を読み取ります。",
  },
];

const usageTips = [
  {
    icon: RefreshCw,
    title: "問題が変わったら更新",
    body: "次の問題へ進んだら、サイドパネルの「更新」でプレビューを撮り直してから「解く」を押します。",
  },
  {
    icon: ImagePlus,
    title: "表やグラフは画像で補足",
    body: "表・グラフが読み取れない場合は、該当部分の画像をサイドパネルへ貼り付けて補足して解きます。",
  },
  {
    icon: MousePointerClick,
    title: "出力形式を切り替える",
    body: "解答のみ／解説を必要に応じて切り替えられます。",
  },
];

export function QuestionSolverScreen() {
  return (
    <div>
      <PageHeader
        title="Webテストを自動で解く"
        description="Chrome拡張機能「SolveSnap」が、開いているタブの問題をスクショまたは自動検知して解答します。ログイン中のこのアカウントのトークン残高を使います。"
        descriptionClassName="text-[#1d1d1f]"
        compact
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/[0.08]">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-white">
          <Download className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">
            SolveSnap Chrome拡張機能
          </h2>
          <p className="mt-1 text-sm font-medium leading-6 text-[#3f3f46]">
            Chromeウェブストアには未公開のため、ZIPをダウンロードして手動で読み込みます。
          </p>
        </div>
        <a
          href="/downloads/solvesnap-extension.zip"
          download
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)]"
        >
          <Download className="h-4 w-4" aria-hidden />
          拡張機能をダウンロード
        </a>
      </div>

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
                  このページでは入力しません
                </h2>
                <p className="mt-2 text-sm font-medium leading-6 text-[#3f3f46]">
                  問題文の入力やJSON貼り付けは不要です。問題の検知と解答生成は、Chrome拡張機能のサイドパネルから行います。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
