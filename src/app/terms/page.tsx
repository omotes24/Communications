import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";

export default function TermsPage() {
  return (
    <AppShell>
      <PageHeader
        title="規約"
        description="Yell for You 1.3の利用に関する規約です。"
      />
      <article className="grid gap-5 rounded-[28px] bg-white p-6 text-sm font-medium leading-7 text-[#424245] shadow-sm ring-1 ring-black/[0.06]">
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">サービス内容</h2>
          <p className="mt-2">
            本サービスは、プロフィール、企業情報、音声文字起こし、質問判定、回答生成を通じて面接準備と面接中の回答整理を支援します。生成内容の正確性、採用結果、第三者との契約成立を保証しません。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">
            ユーザーの責任
          </h2>
          <p className="mt-2">
            ユーザーは、本サービスへの入力内容、本サービスの利用方法、面接での利用可否、録音・文字起こしに関する相手方の同意、会議サービスや所属組織の規約確認について、自らの責任で判断するものとします。本サービスの利用により行った判断、発言、提出物、第三者とのやり取り、その結果については、ユーザー自身が責任を負うものとします。機密情報、第三者の個人情報、契約上入力できない情報は入力しないでください。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">
            アプリ内トークン
          </h2>
          <p className="mt-2">
            AI処理にはアプリ内トークンを使用します。購入はStripe
            Checkoutで処理され、支払い完了後にStripe
            webhookを検証してトークンを付与します。トークンの付与量、消費係数、対象機能は、運用上予告なく変更される場合があります。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">決済</h2>
          <p className="mt-2">
            決済情報はStripeが処理します。本アプリはカード番号や銀行口座番号を保存しません。購入内容、支払い状況、付与トークン数など、サービス提供に必要な範囲の決済関連情報を保存します。返金その他の決済に関する対応は、法令により必要な場合を除き、個別の状況に応じて判断します。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">
            データの取り扱い
          </h2>
          <p className="mt-2">
            本サービスは、プロフィール、企業・求人情報、面接前学習メモ、明示保存した面接履歴、回答チャット履歴、ユーザー設定をSupabaseに保存します。問い合わせフォームでは、名前、返信先メールアドレス、問い合わせ種別、件名、本文、添付画像を送信します。テーマ設定は、ブラウザのlocalStorageに保存される場合があります。
          </p>
          <p className="mt-2">
            音声は文字起こし処理のためOpenAIへ送信されます。本サービスは音声ファイルそのものを永続保存しません。文字起こし結果は画面表示と質問判定に使われ、ユーザーが履歴保存した場合に限り関連する質問・回答がSupabaseへ保存されます。
          </p>
          <p className="mt-2">
            認証・DB保存にはSupabase、ホスティングにはCloudflare
            Workers、AI処理にはOpenAI、決済にはStripe、認証メールと問い合わせメール送信には設定済みのメール配信事業者を利用します。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">データの削除</h2>
          <p className="mt-2">
            アカウント削除を行うと、Supabase
            Authユーザーと、RLS対象のDBデータはcascade削除されます。Supabase
            Storageを使う場合は、設定されたbucket内のユーザーprefixも削除対象です。
          </p>
        </section>
      </article>
    </AppShell>
  );
}
