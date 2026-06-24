import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";

export default function PrivacyPage() {
  return (
    <AppShell>
      <PageHeader
        title="Privacy Policy"
        description="Yell for Youのデータ処理に関する公開プライバシーポリシーです。"
      />
      <article className="grid gap-5 rounded-[28px] bg-white p-6 text-sm font-medium leading-7 text-[#424245] shadow-sm ring-1 ring-black/[0.06]">
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">取得・保存するデータ</h2>
          <p className="mt-2">
            ログイン後、プロフィール、企業・求人情報、面接前学習メモ、明示保存した面接履歴、回答チャット履歴、ユーザー設定をSupabaseに保存します。未保存フォームの一時下書きとテーマ設定はブラウザのlocalStorageに保存される場合があります。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">音声・文字起こし</h2>
          <p className="mt-2">
            音声は文字起こし処理のためOpenAIまたはGroqへ送信されます。アプリは音声ファイルそのものを永続保存しません。文字起こし結果は画面表示と質問判定に使われ、ユーザーが履歴保存した場合に限り関連する質問・回答がSupabaseへ保存されます。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">外部送信先</h2>
          <p className="mt-2">
            認証・DB保存にはSupabase、ホスティングにはVercel、AI処理にはOpenAIまたはGroq、認証メールには設定済みのメール配信事業者を利用します。メール配信事業者はStaging/Production設定時にResend、Postmark、Amazon SES等から確定します。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">削除</h2>
          <p className="mt-2">
            アカウント削除を行うと、Supabase Authユーザーと、RLS対象のDBデータはcascade削除されます。Supabase Storageを使う場合は、設定されたbucket内のユーザーprefixも削除対象です。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">未確認事項</h2>
          <p className="mt-2">
            会社運営者情報、正式な問い合わせメールアドレス、メール配信事業者、法域、公開日、改定日は本番公開前に確定が必要です。この文章は実装に基づく下書きであり、法務確認前です。
          </p>
        </section>
      </article>
    </AppShell>
  );
}
