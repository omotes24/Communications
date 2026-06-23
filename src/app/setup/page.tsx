import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  Database,
  KeyRound,
  Monitor,
  Radio,
  Server,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";

const systemFlow = [
  "プロフィールと会社スロットをブラウザに保存",
  "会社Webサイトと志望コースをもとに面接前メモを作成",
  "Meet/Zoomのタブ音声を文字起こしして質問候補を検知",
  "検知した質問を回答チャットへ自動送信し、回答案を生成",
];

const apiRoutes = [
  "/api/research-company",
  "/api/learn-interview-context",
  "/api/transcribe-audio",
  "/api/classify-question",
  "/api/generate-answer",
];

export default function SetupPage() {
  return (
    <AppShell>
      <PageHeader
        title="Settings"
        description="QuestionTurboのフロントエンド、バックエンド、AI連携、音声処理の動作を確認できます。"
      />

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <section className="rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06]">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e8f2ff] text-[#0071e3]">
                <Workflow className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0071e3]">
                  System
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  面接支援の流れ
                </h2>
                <p className="mt-3 text-sm font-medium leading-7 text-[#6e6e73]">
                  自分の情報と会社情報を事前に整理し、面接中は音声から質問を検知して、回答チャットへ自動で回答案を作ります。
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {systemFlow.map((item, index) => (
                <div
                  key={item}
                  className="rounded-2xl bg-[#f5f5f7] p-4 text-sm font-semibold leading-6 text-[#1d1d1f]"
                >
                  <span className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs text-[#0071e3] shadow-sm ring-1 ring-black/[0.06]">
                    {index + 1}
                  </span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <div className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                <Monitor className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-5 text-xl font-semibold tracking-tight">
                フロントエンド
              </h2>
              <p className="mt-3 text-sm font-medium leading-7 text-[#6e6e73]">
                Next.jsの画面でプロフィール、会社スロット、面接チャットを操作します。入力中のプロフィールや会社情報、履歴はブラウザのlocalStorageに保存されます。
              </p>
              <div className="mt-4 grid gap-2 text-xs font-semibold text-[#424245]">
                <span className="rounded-full bg-[#f5f5f7] px-3 py-2">
                  音声取得: getDisplayMedia / MediaRecorder
                </span>
                <span className="rounded-full bg-[#f5f5f7] px-3 py-2">
                  APIキー: ブラウザへ配布しない
                </span>
              </div>
            </div>

            <div className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                <Server className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-5 text-xl font-semibold tracking-tight">
                バックエンド
              </h2>
              <p className="mt-3 text-sm font-medium leading-7 text-[#6e6e73]">
                サーバー側のRoute HandlerがAI APIを呼びます。文字起こし、質問判定、回答生成、企業リサーチはすべてサーバー経由で処理します。
              </p>
              <div className="mt-4 grid gap-2 text-xs font-semibold text-[#424245]">
                {apiRoutes.map((route) => (
                  <code
                    key={route}
                    className="rounded-full bg-[#f5f5f7] px-3 py-2"
                  >
                    {route}
                  </code>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <div className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                <BrainCircuit className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-5 text-xl font-semibold tracking-tight">
                AIモデルの役割
              </h2>
              <p className="mt-3 text-sm font-medium leading-7 text-[#6e6e73]">
                Groqを使う設定では、音声はWhisper系モデル、質問判定は軽量構造化モデル、回答生成は回答用モデル、企業理解はリサーチ用モデルに分けています。
              </p>
            </div>

            <div className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                <Radio className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-5 text-xl font-semibold tracking-tight">
                面接中の動作
              </h2>
              <p className="mt-3 text-sm font-medium leading-7 text-[#6e6e73]">
                タブ音声を短い区間で文字起こしし、質問らしい文を検知すると自動で回答生成へ送ります。LLMの応答が遅い時は先に仮回答を表示します。
              </p>
            </div>
          </section>

          <section className="rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06]">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                  Privacy
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  キーとデータの扱い
                </h2>
                <p className="mt-3 text-sm font-medium leading-7 text-[#6e6e73]">
                  APIキーはサーバー側の環境変数だけで扱います。ブラウザ、localStorage、GitHubには保存しません。
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
          </section>
        </div>

        <aside className="grid gap-5">
          <div className="rounded-[30px] bg-[#1d1d1f] p-5 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8ec5ff]">
              Status
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Groqで動作
            </h2>
            <div className="mt-5 grid gap-2 text-sm font-semibold">
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                AI_PROVIDER: groq
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                AI_MOCK_MODE: false
              </div>
            </div>
          </div>

          <div className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
              <KeyRound className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-5 text-xl font-semibold tracking-tight">
              キーの変更場所
            </h2>
            <p className="mt-3 text-sm font-medium leading-7 text-[#6e6e73]">
              ローカルではプロジェクト直下の `.env.local`、VercelではProject SettingsのEnvironment Variablesを変更します。
            </p>
          </div>

          <div className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
              <Database className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-5 text-xl font-semibold tracking-tight">
              保存される情報
            </h2>
            <p className="mt-3 text-sm font-medium leading-7 text-[#6e6e73]">
              プロフィール、会社スロット、学習メモ、回答履歴はこのブラウザ内に保存します。削除はPrivacyページから実行できます。
            </p>
          </div>

          <div className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0071e3]">
              Next
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              操作へ進む
            </h2>
            <div className="mt-5 grid gap-2">
              <Link
                href="/profile"
                className="inline-flex h-12 items-center justify-between rounded-full bg-[#1d1d1f] px-5 text-sm font-semibold text-white transition hover:bg-[#424245]"
              >
                自分の情報
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/company"
                className="inline-flex h-12 items-center justify-between rounded-full border border-neutral-950/10 px-5 text-sm font-semibold text-[#1d1d1f] transition hover:border-neutral-950"
              >
                会社スロット
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
