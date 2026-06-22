import Link from "next/link";

import { AppShell } from "@/components/layout/AppShell";

export default function Home() {
  return (
    <AppShell>
      <section className="rounded-md border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">開始</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          まずユーザー情報と応募企業情報を登録し、面接練習または同意済み会話支援を開始してください。回答案は本人が確認して使う話すポイントとして表示されます。
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/profile"
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white"
          >
            ユーザー情報を登録
          </Link>
          <Link
            href="/support"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
          >
            同意済み支援を開く
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
