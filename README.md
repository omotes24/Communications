# Yell for You 1.2

日本語面接の準備、企業理解、リアルタイム文字起こし、質問判定、回答案作成を支援するWebアプリです。

回答の自動代行、自動音声回答、Zoom/Google Meetへの自動入力、隠し表示、ステルス表示は実装しません。面接中に表示される回答案は、ユーザーが自分で判断して利用するための補助情報です。

## 主な機能

- Supabase Authによるログイン
- プロフィール、企業情報、面接ログ、設定のクラウド保存
- localStorageからクラウド保存への移行
- OpenAI APIを使ったAI処理
- OpenAI web searchによる企業・採用情報の調査
- 複数の会社を比較する: URL/企業名から企業研究を作成し、会社スロットへ保存
- グループディスカッション練習: AI参加者との実戦練習、発話ログ、議論マップ、根拠付き評価
- アプリ内トークン残高、予約、消費履歴
- Stripe Checkoutによるトークン購入
- Stripe webhook検証後のトークン付与
- 公開ページ: `/privacy`, `/terms`, `/account-deletion`, `/help`, `/pricing`
- 管理ダッシュボード: `/admin`（管理者のみ）

## 管理ダッシュボード

`/admin` で、ユーザー数・トークン残高合計・機能別/日別の使用量・Stripe売上・
最近の購入とトークンイベントをリアルタイム（30秒ごと自動更新）に確認できます。

- 管理者は環境変数 `ADMIN_EMAILS`（カンマ区切りのメールアドレス）で指定します。
  例: `ADMIN_EMAILS=owner@example.com,friend@example.com`
  Vercelの環境変数から変更できるため、デプロイ権限を持つメンバーが管理者を追加できます。
- データはSupabaseの `token_wallets` / `token_ledger` / `ai_usage_events` /
  `stripe_checkout_grants` を集計しています（サービスロールキーが必要）。
- ローカル開発（`LOCAL_AUTH_BYPASS=true`・`ADMIN_EMAILS`未設定）では
  仮ユーザーが管理者として扱われ、レイアウトの確認ができます。

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
NEXT_PUBLIC_APP_NAME=Yell for You 1.2
NEXT_PUBLIC_SITE_URL=
OPENAI_API_KEY=

OPENAI_TRANSCRIPTION_MODEL=gpt-realtime-whisper
OPENAI_TRANSCRIPTION_DELAY=high
OPENAI_AUDIO_NOISE_REDUCTION=far_field
OPENAI_CLASSIFIER_MODEL=gpt-5.4-nano
OPENAI_ANSWER_MODEL=gpt-5.6-luna
OPENAI_RESEARCH_MODEL=gpt-5.6-terra
OPENAI_GROUP_DISCUSSION_MODEL=gpt-5.6-terra
OPENAI_GD_MOCK_MODE=false
COMPANY_INTELLIGENCE_STRICT_MODE=true
COMPANY_INTELLIGENCE_MOCK_MODE=false
COMPANY_INTELLIGENCE_DEEP_RESEARCH_MODEL=gpt-5.6-terra
COMPANY_INTELLIGENCE_SYNTHESIS_MODEL=gpt-5.6-terra

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

`NEXT_PUBLIC_APP_NAME` と `NEXT_PUBLIC_SITE_URL` はビルド時に反映されます。Vercelで変更した場合は再デプロイが必要です。Productionでは `NEXT_PUBLIC_SITE_URL=https://communications-umber.vercel.app` を設定します。

## Supabase

Supabase Auth、RLS付きPostgres、アプリ内トークン台帳を使います。

AuthのURL設定:

- Site URL: `https://communications-umber.vercel.app`
- Redirect URLs:
  - `https://communications-umber.vercel.app/auth/confirm`
  - `https://communications-umber.vercel.app/auth/callback`
  - `https://communications-umber.vercel.app/auth/reset-password`
  - `http://localhost:3000/auth/confirm`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/reset-password`

Confirm signupメールテンプレートのボタンURLは、標準テンプレートの場合は `{{ .ConfirmationURL }}` を使います。独自リンクにする場合は `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/profile` にします。

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
- `company_research_jobs`
- `company_research_reports`
- `company_research_audits`
- `group_discussion_sessions`
- `group_discussion_utterances`
- `reserve_tokens`
- `settle_tokens`
- `release_token_reservation`
- `release_expired_token_reservations`
- `grant_purchased_tokens`

詳細は [docs/multi-user-supabase.md](docs/multi-user-supabase.md) と [docs/staging-hardening-runbook.md](docs/staging-hardening-runbook.md) を参照してください。

## Stripe決済

Web決済はStripe Checkoutで処理します。アプリはカード番号や銀行口座番号を保存しません。

- 料金ページ: `/pricing`
- token設定: `1,000円 = 300,000 tokens`, `3,000円 = 1,000,000 tokens`, `10,000円 = 4,000,000 tokens`
- Checkout作成API: `/api/billing/checkout`
- Webhook: `/api/stripe/webhook`
- Webhook対象event:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`

Stripe webhookはraw bodyと `Stripe-Signature` で署名検証します。支払い済みCheckout Sessionだけを処理し、`stripe_checkout_grants.stripe_checkout_session_id` をprimary keyにして二重付与を防ぎます。

売上の受取口座、本人確認、入金スケジュールはStripe DashboardのPayout settingsで設定します。日本のStripeアカウントでは日次入金は利用できず、標準は手動入金です。週次または月次入金も選択できます。

## 問い合わせフォーム

`/help` の問い合わせフォームは `/api/help/contact` からメール配信事業者へ送信します。宛先メールアドレスはWebページやクライアントバンドルに含めず、サーバー環境変数で管理します。画像はPNG、JPEG、WebP、GIFを最大3枚まで添付できます。

- `RESEND_API_KEY`: Resend API key
- `HELP_CONTACT_FROM_EMAIL`: 送信元。検証済みドメインのメールアドレスを設定します。
- `HELP_CONTACT_TO_EMAIL`: 受信用メールアドレス

## 複数の会社を比較する

`/company/intelligence` では、企業サイト、採用ページ、求人票、IR、ニュースなどのURLまたは企業名から、根拠付きの企業研究メモを作成できます。

Phase 1で実装済み:

- ホーム画面と会社スロット画面からの導線
- URL入力と安全性チェック
- OpenAI web searchによる公開情報調査
- Deep Research raw reportの別モデルによる正規化
- 確認できた情報、AI推定、要確認、情報源、調査上の制約の分離表示
- Hallucination監査と `safeToDisplay=false` 時の表示停止
- 会社スロットへの保存
- 保存済み会社スロットを比較候補として表示
- `AI_MOCK_MODE=true` でOpenAI APIを呼ばない動作確認

OpenAIへ送信される情報:

- 貼り付けたURLまたは企業名
- 応募職種
- 選択中プロフィールから抽出した最小限の自己情報
- 価値観プリセット

追加環境変数:

- `COMPANY_INTELLIGENCE_STRICT_MODE`: `true` の場合、根拠なしの高速プレビューを表示しません。
- `COMPANY_INTELLIGENCE_MOCK_MODE`: 複数の会社を比較する機能だけをモックにします。
- `COMPANY_INTELLIGENCE_DEEP_RESEARCH_MODEL`: 複数の会社を比較する調査用モデル。既定は `gpt-5.6-terra` です。Organization認証が必要な `*-deep-research` 系モデルや `mini` 系モデルを設定している場合も、実行時は `OPENAI_RESEARCH_MODEL` へフォールバックします。
- `COMPANY_INTELLIGENCE_SYNTHESIS_MODEL`: 正規化用モデル。既定は `gpt-5.6-terra` です。

未実装:

- Production DBへの `company_research_jobs` / `company_research_reports` / `company_research_audits` migration適用
- Vercel Route Handlerを長時間待たせない永続background polling worker
- 2〜5社の比較表生成API
- 経験カード生成、一貫性チェック、選考改善分析

注意:

- 企業研究のWeb検索は `search_context_size=high` を使います。
- ログインが必要な採用サイトやPDF/画像中心ページは精度が落ちる場合があります。
- 口コミ・第三者情報は断定材料ではなく参考情報として扱います。
- 比較や適合度はAI推定であり、内定・入社判断を保証しません。

## グループディスカッション練習

`/group-discussion` では、1人練習またはAI参加者付き練習でGDの発言・論点整理・結論形成を練習できます。

Phase 1で実装済み:

- ホーム画面からの導線
- `/group-discussion`, `/group-discussion/session/[sessionId]`, `/group-discussion/result/[sessionId]`, `/group-discussion/history`
- AIテーマ生成
- 1人練習モード
- AI参加者付き練習モード
- テキスト入力による発話追加
- 既存Realtime transcriptionパネルによるマイク/タブ音声文字起こし
- 確定文字起こしの発話ログ取り込み
- 発言時間、発言回数、質問回数、他者発言への接続、議論前進/後退、論点整理、遮り候補、結論形成、時間管理の軽量分析
- 議論マップ表示
- セッション終了後の最終評価
- 評価項目と議論マップへの根拠発話ID付与
- 履歴保存と結果再表示
- `AI_MOCK_MODE=true` または `OPENAI_GD_MOCK_MODE=true` でOpenAI APIを呼ばない動作確認

OpenAIへ送信される情報:

- GDテーマ、参加者設定、直近発話ログ
- AIテーマ生成時のカテゴリ、難易度、選択中プロフィール・会社情報の要約
- 最終評価時の発話ログ

追加環境変数:

- `OPENAI_GROUP_DISCUSSION_MODEL`: GDテーマ生成、AI参加者、最終評価で使うモデル。既定は `gpt-5.6-terra` です。
- `OPENAI_GD_MOCK_MODE`: GD機能だけをモックにします。

保存とプライバシー:

- 生音声は標準保存しません。
- 文字起こしと手動入力の発話ログは、議論マップ、評価、履歴再表示のためにアプリストレージへ保存されます。
- ログイン済みの場合、既存の `/api/storage` 経由でSupabaseへ同期されます。
- 実選考での無断録音、隠れた支援、第三者の同意なしの利用は想定していません。

未実装:

- 招待リンク付きの複数人ルーム
- 参加者ごとのマイク分離
- 複数人の同意フロー
- ルーム内リアルタイム同期
- 参加者別評価
- 過去セッション比較と弱点トレンド

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
3. Yell for You 1.2の面接画面で「タブ・画面音声を共有」を押します。
4. Chromeの共有ダイアログで「Chromeタブ」を選び、`meet.google.com` のタブを選択します。
5. 「タブの音声も共有」または「Share tab audio」が有効になっていることを確認して共有します。

「画面全体」や「ウィンドウ」を選ぶと、Mac/Chromeの設定によって音声が付かないことがあります。相手側音声を安定して拾うには、Meetの「Chromeタブ」を共有します。

## データとプライバシー

- 生音声は標準保存しません。
- セッション終了時に取得済みMediaStreamTrackを停止します。
- 文字起こし結果は画面表示と質問判定に使われます。
- ユーザーが履歴保存した場合だけ、関連する質問・回答がSupabaseへ保存されます。
- グループディスカッション練習では、ユーザーが開始した練習の発話ログ、議論マップ、評価結果を履歴再表示のために保存します。
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
