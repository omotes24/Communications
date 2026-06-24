# Yell for You 1.1

日本語面接の準備、企業理解、リアルタイム文字起こし、質問判定、回答案作成を支援するWebアプリです。

回答の自動代行、自動音声回答、Zoom/Google Meetへの自動入力、隠し表示、ステルス表示は実装しません。面接中に表示される回答案は、ユーザーが自分で判断して利用するための補助情報です。

## 主な機能

- Supabase Authによるログイン
- プロフィール、企業情報、面接ログ、設定のクラウド保存
- localStorageからクラウド保存への移行
- OpenAI APIを使ったAI処理
- アプリ内トークン残高、予約、消費履歴
- Stripe Checkoutによるトークン購入
- Stripe webhook検証後のトークン付与
- 公開ページ: `/privacy`, `/terms`, `/account-deletion`, `/help`, `/pricing`

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## 環境変数

`.env.local` に設定します。秘密鍵はサーバー側Route Handlerだけで参照し、クライアントJavaScript、localStorage、ログへ出しません。

```env
AI_PROVIDER=openai
NEXT_PUBLIC_APP_NAME=Yell for You 1.1
OPENAI_API_KEY=

OPENAI_TRANSCRIPTION_MODEL=gpt-realtime-whisper
OPENAI_CLASSIFIER_MODEL=gpt-5.4-nano
OPENAI_ANSWER_MODEL=gpt-5.4-mini
OPENAI_RESEARCH_MODEL=gpt-5.5

AI_MOCK_MODE=false

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKETS=

APP_SIGNUP_GRANT_TOKENS=0
APP_REALTIME_SESSION_RESERVATION_SECONDS=180
CRON_SECRET=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

`NEXT_PUBLIC_APP_NAME` はビルド時に反映されます。Vercelで変更した場合は再デプロイが必要です。

## Supabase

Supabase Auth、RLS付きPostgres、アプリ内トークン台帳を使います。

適用するmigration:

```bash
supabase db push
```

主なテーブル/関数:

- `token_wallets`
- `token_ledger`
- `token_reservations`
- `ai_usage_events`
- `stripe_checkout_grants`
- `reserve_tokens`
- `settle_tokens`
- `release_token_reservation`
- `release_expired_token_reservations`
- `grant_purchased_tokens`

詳細は [docs/multi-user-supabase.md](docs/multi-user-supabase.md) と [docs/staging-hardening-runbook.md](docs/staging-hardening-runbook.md) を参照してください。

## Stripe決済

Web決済はStripe Checkoutで処理します。アプリはカード番号や銀行口座番号を保存しません。

- 料金ページ: `/pricing`
- token設定: `1円 = 300 app tokens`
- Checkout作成API: `/api/billing/checkout`
- Webhook: `/api/stripe/webhook`
- Webhook対象event:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`

Stripe webhookはraw bodyと `Stripe-Signature` で署名検証します。支払い済みCheckout Sessionだけを処理し、`stripe_checkout_grants.stripe_checkout_session_id` をprimary keyにして二重付与を防ぎます。

売上の受取口座、本人確認、入金スケジュールはStripe DashboardのPayout settingsで設定します。日本のStripeアカウントでは日次入金は利用できず、標準は手動入金です。週次または月次入金も選択できます。

## 問い合わせフォーム

`/help` の問い合わせフォームは `/api/help/contact` からメール配信事業者へ送信します。宛先メールアドレスはWebページやクライアントバンドルに含めず、サーバー環境変数で管理します。

- `RESEND_API_KEY`: Resend API key
- `HELP_CONTACT_FROM_EMAIL`: 送信元。検証済みドメインのメールアドレスを設定します。
- `HELP_CONTACT_TO_EMAIL`: 受信用メールアドレス

## Vercelデプロイ

PreviewとProductionで環境変数を分けます。

- Vercel Preview -> Supabase Staging / Stripe test mode
- Vercel Production -> Supabase Production / Stripe live mode

反映の流れ:

```bash
git push origin <branch>
```

Previewで確認後、Productionへ反映します。Production migration適用やProduction deployは、明示的に許可された場合だけ行います。

## Vercel Cron

期限切れtoken予約の解放は以下で実行します。

- Production: Vercel Cron
- Staging Preview: CLIまたは保護された管理APIから手動実行

Vercel Cronの認証は `CRON_SECRET` を使います。Vercelは `Authorization: Bearer <CRON_SECRET>` を送信します。Route Handlerはsecret未設定時にfail closedします。

## Google Meetタブ音声

Google Meetの相手側音声を拾う場合は、SafariではなくChromeまたはEdgeを使います。Meetはデスクトップアプリではなく、ブラウザタブで開いてください。

1. ChromeでGoogle Meetを開き、面接ルームに入ります。
2. 同じChromeの別タブで `http://127.0.0.1:3000/support` を開きます。
3. Yell for You 1.1の面接画面で「タブ・画面音声を共有」を押します。
4. Chromeの共有ダイアログで「Chromeタブ」を選び、`meet.google.com` のタブを選択します。
5. 「タブの音声も共有」または「Share tab audio」が有効になっていることを確認して共有します。

「画面全体」や「ウィンドウ」を選ぶと、Mac/Chromeの設定によって音声が付かないことがあります。相手側音声を安定して拾うには、Meetの「Chromeタブ」を共有します。

## データとプライバシー

- 生音声は標準保存しません。
- セッション終了時に取得済みMediaStreamTrackを停止します。
- 文字起こし結果は画面表示と質問判定に使われます。
- ユーザーが履歴保存した場合だけ、関連する質問・回答がSupabaseへ保存されます。
- アカウント削除時はSupabase Authユーザー、DBデータ、設定済みStorage bucket内のユーザーprefix配下ファイルを削除します。
- Stripe側の取引記録はStripeの保持ポリシーに従います。

## テスト

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
```

E2Eは `AI_MOCK_MODE=true` の開発サーバーを自動起動し、AI APIを直接呼びません。

## 既知の制約

- Production用のSupabase project、Stripe live key、SMTP、Payout設定は人間がDashboardで設定します。
- Apple In-App Purchase、Google Play Billing、サブスクリプション、返金管理画面は未実装です。
- 特定商取引法に基づく表示、正式な販売者情報、問い合わせ先、返金条件は本番公開前に確定が必要です。
- 音声共有の可否はブラウザとOSの権限・実装に依存します。
- 回答案の事実性は登録情報とプロンプト制約で抑制しますが、最終判断はユーザーが行います。
