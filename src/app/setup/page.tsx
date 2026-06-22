import Link from "next/link";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";

export default function SetupPage() {
  return (
    <AppShell>
      <PageHeader
        title="初期設定"
        description="OpenAI API キーはサーバー側の .env.local にだけ置き、ブラウザや localStorage には保存しません。"
      />
      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 text-sm leading-6">
        <div>
          <h2 className="font-semibold">必要な環境変数</h2>
          <pre className="mt-2 overflow-x-auto rounded-md bg-slate-950 p-3 text-xs text-white">
            {`OPENAI_API_KEY=...\nOPENAI_TRANSCRIPTION_MODEL=gpt-realtime-whisper\nOPENAI_CLASSIFIER_MODEL=gpt-5.4-nano\nOPENAI_ANSWER_MODEL=gpt-5.4-mini`}
          </pre>
        </div>
        <div>
          <h2 className="font-semibold">送信される情報</h2>
          <p className="mt-1 text-slate-600">
            質問判定では確定文字起こし、回答生成では質問、登録済みプロフィール、応募情報を
            OpenAI API へ送信します。生音声は標準保存しません。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/profile"
            className="rounded-md bg-slate-950 px-4 py-2 font-medium text-white"
          >
            ユーザー情報へ
          </Link>
          <Link
            href="/company"
            className="rounded-md border border-slate-300 px-4 py-2 font-medium"
          >
            企業・求人情報へ
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
