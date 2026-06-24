import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";

export default function HelpPage() {
  return (
    <AppShell>
      <PageHeader
        title="Help"
        description="問い合わせとサポート情報です。"
      />
      <article className="grid gap-5 rounded-[28px] bg-white p-6 text-sm font-medium leading-7 text-[#424245] shadow-sm ring-1 ring-black/[0.06]">
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">問い合わせ</h2>
          <p className="mt-2">
            正式なサポートメールアドレスは本番公開前に確定してください。Stagingでは運営者の検証用メールアドレスをVercel環境変数または公開文面に設定してください。
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-[#1d1d1f]">必要な情報</h2>
          <p className="mt-2">
            不具合連絡時は、発生日時、利用画面、操作内容、表示されたエラー、利用ブラウザを共有してください。APIキー、パスワード、認証メールのリンクは送らないでください。
          </p>
        </section>
      </article>
    </AppShell>
  );
}
