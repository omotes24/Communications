import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";

export default function PrivacyPage() {
  return (
    <AppShell>
      <PageHeader
        title="データの取り扱い"
        description="Yell for You 1.1で扱うデータの説明です。"
      />
      <article className="grid gap-5 rounded-[28px] bg-white p-6 text-sm font-medium leading-7 text-[#424245] shadow-sm ring-1 ring-black/[0.06]">
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">取得・保存するデータ</h2>
          <p className="mt-2">
            ログイン後、プロフィール、企業・求人情報、面接前学習メモ、明示保存した面接履歴、回答チャット履歴、ユーザー設定をSupabaseに保存します。問い合わせフォームでは、名前、返信先メールアドレス、問い合わせ種別、件名、本文を送信します。未保存フォームの一時下書きとテーマ設定はブラウザのlocalStorageに保存される場合があります。
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
            認証・DB保存にはSupabase、ホスティングにはVercel、AI処理にはOpenAIまたはGroq、決済にはStripe、認証メールと問い合わせメール送信には設定済みのメール配信事業者を利用します。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">決済データ</h2>
          <p className="mt-2">
            購入時はStripe Checkoutへ遷移します。本アプリはカード番号や銀行口座番号を保存しません。支払い完了後、Stripe Checkout Session ID、購入プラン、付与トークン数、支払額、Stripe customer/payment IDの参照値をSupabaseに保存します。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">削除</h2>
          <p className="mt-2">
            アカウント削除を行うと、Supabase Authユーザーと、RLS対象のDBデータはcascade削除されます。Supabase Storageを使う場合は、設定されたbucket内のユーザーprefixも削除対象です。
          </p>
        </section>
      </article>
    </AppShell>
  );
}
