import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";

export default function TermsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Terms"
        description="Yell for You 1.1の利用規約ドラフトです。"
      />
      <article className="grid gap-5 rounded-[28px] bg-white p-6 text-sm font-medium leading-7 text-[#424245] shadow-sm ring-1 ring-black/[0.06]">
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">サービス内容</h2>
          <p className="mt-2">
            本サービスは、プロフィール、企業情報、音声文字起こし、質問判定、回答生成を通じて面接準備と面接中の回答整理を支援します。生成内容の正確性、採用結果、第三者との契約成立を保証しません。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">ユーザーの責任</h2>
          <p className="mt-2">
            ユーザーは入力内容、面接での利用可否、録音・文字起こしに関する相手方や会議サービスの規約確認について責任を負います。機密情報、第三者の個人情報、契約上入力できない情報は入力しないでください。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">アプリ内トークン</h2>
          <p className="mt-2">
            AI処理にはアプリ内トークンを使用します。購入はStripe Checkoutで処理され、支払い完了後にStripe webhookを検証してトークンを付与します。トークンの付与量、消費係数、対象機能は運用上変更される場合があります。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">決済</h2>
          <p className="mt-2">
            決済情報はStripeが処理します。本アプリはカード番号や銀行口座番号を保存しません。返金、領収書、消費税、特定商取引法に基づく表示、正式な販売者情報は本番公開前に確定が必要です。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">未確認事項</h2>
          <p className="mt-2">
            運営者名、所在地、準拠法、禁止事項の詳細、免責範囲、サポート窓口、改定手続きは本番公開前に確定が必要です。この文章は実装に基づく下書きであり、法務確認前です。
          </p>
        </section>
      </article>
    </AppShell>
  );
}
