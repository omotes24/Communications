import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";

export default function AccountDeletionPage() {
  return (
    <AppShell>
      <PageHeader
        title="Account Deletion"
        description="Google Play等の公開要件に対応するアカウント削除案内です。"
      />
      <article className="grid gap-5 rounded-[28px] bg-white p-6 text-sm font-medium leading-7 text-[#424245] shadow-sm ring-1 ring-black/[0.06]">
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">アプリ内で削除する方法</h2>
          <p className="mt-2">
            ログイン後、Account → アカウント削除へ進み、確認欄にDELETEと入力して削除します。削除するとSupabase Authユーザー、プロフィール、企業情報、面接履歴、利用履歴、設定が削除されます。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">保存期間</h2>
          <p className="mt-2">
            アカウント削除後、通常のアプリDB上のユーザーデータは削除されます。Vercel、Supabase、メール配信事業者、OpenAI/Groq側のログ保持期間は各事業者のポリシーに従います。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">削除できるデータ</h2>
          <p className="mt-2">
            プロフィール、企業情報、面接前学習、明示保存した面接履歴、回答チャット履歴、ユーザー設定、トークン利用記録、設定済みStorage bucket内のユーザーprefix配下ファイルが対象です。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">未確認事項</h2>
          <p className="mt-2">
            外部から削除依頼を受け付ける正式な問い合わせ先メールアドレスは本番公開前に確定してください。
          </p>
        </section>
      </article>
    </AppShell>
  );
}
