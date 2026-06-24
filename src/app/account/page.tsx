import Link from "next/link";

import { PasswordUpdateForm } from "@/components/auth/PasswordUpdateForm";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireCurrentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireCurrentUser();

  return (
    <AppShell>
      <PageHeader
        title="Account"
        description="ログイン情報、パスワード、利用状況を管理します。"
      />

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Signed in
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            {user.email ?? "メールアドレス未設定"}
          </h2>
          <div className="mt-6">
            <PasswordUpdateForm />
          </div>
        </div>

        <aside className="grid gap-3 self-start">
          <Link
            href="/account/usage"
            className="rounded-[22px] bg-white p-5 text-sm font-semibold shadow-sm ring-1 ring-black/[0.06] transition hover:-translate-y-0.5"
          >
            利用履歴を見る
          </Link>
          <Link
            href="/account/delete"
            className="rounded-[22px] bg-red-50 p-5 text-sm font-semibold text-red-700 ring-1 ring-red-100 transition hover:-translate-y-0.5"
          >
            アカウント削除
          </Link>
        </aside>
      </section>
    </AppShell>
  );
}
