import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";

export default function SetupPage() {
  return (
    <AppShell>
      <PageHeader
        title="Setup"
        description="APIキーは .env.local だけで管理します。ブラウザ、localStorage、GitHubには保存しません。"
      />

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06]">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                準備は `.env.local` で完結
              </h2>
              <p className="mt-3 text-sm font-medium leading-7 text-neutral-600">
                新しいAPIキーに差し替える時は、プロジェクト直下の `.env.local`
                の `GROQ_API_KEY` だけを変更します。
              </p>
            </div>
          </div>

          <details className="mt-6 rounded-2xl bg-[#f5f5f7] p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              環境変数を見る
            </summary>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-[#1d1d1f] p-4 text-xs leading-6 text-white">
              {`AI_PROVIDER=groq
GROQ_API_KEY=新しいAPIキー

GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
GROQ_STRUCTURED_MODEL=openai/gpt-oss-20b
GROQ_ANSWER_MODEL=openai/gpt-oss-120b
GROQ_RESEARCH_MODEL=groq/compound

AI_MOCK_MODE=false`}
            </pre>
          </details>
        </div>

        <aside className="rounded-[30px] bg-[#1d1d1f] p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8ec5ff]">
            Next
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            入力へ進む
          </h2>
          <div className="mt-6 grid gap-2">
            <Link
              href="/profile"
              className="inline-flex h-12 items-center justify-between rounded-full bg-white px-5 text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
            >
              自分のこと
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/company"
              className="inline-flex h-12 items-center justify-between rounded-full border border-white/15 px-5 text-sm font-semibold text-white transition hover:bg-white hover:text-neutral-950"
            >
              会社スロット
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
