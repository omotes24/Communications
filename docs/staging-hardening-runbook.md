# 本番化前監査 / Staging導入 Runbook

## 最終アプリ名とBundle ID候補

- App name: `Yell for You 1.3`
- iOS Bundle ID候補: `jp.omotes.yellforyou`
- Android applicationId候補: `jp.omotes.yellforyou`
- Web production domain: `https://www.yell-for-you.jp`
- 初回検証URL: Staging Workerの `https://<worker-name>.<subdomain>.workers.dev`

Capacitor、iOS、Android、Apple In-App Purchase、Google Play BillingはこのPhaseでは追加しません。Web決済はStripe Checkoutで処理します。

## 人間が先に行う設定

1. Supabase projectを2つ作成します。
   - `Yell for You 1.3 Staging`
   - `Yell for You 1.3 Production`
2. 認証メール用SMTPを契約・設定します。
   - 推奨候補: Resend、Postmark、Amazon SES
   - Supabase標準メール配信のまま一般公開しないでください。
3. Cloudflare WorkerをStagingとProductionで別々に作成します。同じWorkerの変数を
   切り替えて共用しません。
   - Staging Worker -> Supabase Staging / Stripe test mode / Staging用OpenAI key
   - Production Worker -> Supabase Production / Stripe live mode / Production用OpenAI key
4. `NEXT_PUBLIC_*` はWorkers BuildsのBuild Variablesへ登録します。`wrangler.jsonc` の
   `vars` は実行時の非機密値、API keyやService RoleなどはWorker Secretsへ登録します。
5. 秘密鍵はCodex会話欄、GitHub、`wrangler.jsonc` へ貼らず、Cloudflare Dashboardまたは
   `wrangler secret put` で直接設定します。
6. Cloudflare Productionアカウント、Production Worker、Production Secretsはオーナー
   だけが管理します。共同編集者へはProductionの権限を付与しません。

## Cloudflare Staging設定値

次の `NEXT_PUBLIC_*` はStagingのWorkers BuildsにBuild Variablesとして登録します。
`NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` は、現在の
`wrangler.jsonc` の必須bindingにも合わせてStaging Workerのruntimeにも登録します。

```env
NEXT_PUBLIC_SUPABASE_URL=<staging url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging anon key>
NEXT_PUBLIC_APP_NAME=Yell for You 1.3
NEXT_PUBLIC_SITE_URL=<staging workers.dev url>
NEXT_PUBLIC_PRODUCT_ANALYTICS_ENABLED=true
SUPABASE_SERVICE_ROLE_KEY=<staging service role key>
SUPABASE_STORAGE_BUCKETS=
APP_SIGNUP_GRANT_TOKENS=300000
APP_REALTIME_SESSION_RESERVATION_SECONDS=180
CRON_SECRET=<staging cron secret>
STRIPE_SECRET_KEY=<stripe test secret key>
STRIPE_WEBHOOK_SECRET=<stripe staging webhook secret>
RESEND_API_KEY=<staging Resend key>
HELP_CONTACT_FROM_EMAIL=<staging verified sender>
HELP_CONTACT_TO_EMAIL=<staging inbox>
ADMIN_USER_IDS=<staging owner test user UUID>
ADMIN_AUDIT_HMAC_SECRET=<staging only random secret>
AI_PROVIDER=openai
OPENAI_API_KEY=<staging/test key>
OPENAI_TRANSCRIPTION_MODEL=gpt-realtime-whisper
OPENAI_TRANSCRIPTION_DELAY=high
OPENAI_CLASSIFIER_MODEL=gpt-5.4-nano
OPENAI_ANSWER_MODEL=gpt-5.6-luna
OPENAI_RESEARCH_MODEL=gpt-5.6-terra
OPENAI_COMPANY_RESEARCH_MODEL=gpt-5.6-sol
OPENAI_INTERVIEW_LEARNING_MODEL=gpt-5.6-sol
AI_MOCK_MODE=false
```

## Cloudflare Production設定値

ProductionのBuild VariablesとruntimeのVariables / Secretsは、Stagingからコピーせず
Production専用値を登録します。`ADMIN_USER_IDS` は単一オーナーのSupabase Auth UUID
1件だけにします。

```env
NEXT_PUBLIC_SUPABASE_URL=<production url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production anon key>
NEXT_PUBLIC_APP_NAME=Yell for You 1.3
NEXT_PUBLIC_SITE_URL=https://www.yell-for-you.jp
NEXT_PUBLIC_PRODUCT_ANALYTICS_ENABLED=true
SUPABASE_SERVICE_ROLE_KEY=<production service role key>
SUPABASE_STORAGE_BUCKETS=
APP_SIGNUP_GRANT_TOKENS=0
APP_REALTIME_SESSION_RESERVATION_SECONDS=180
CRON_SECRET=<production cron secret>
STRIPE_SECRET_KEY=<stripe live secret key>
STRIPE_WEBHOOK_SECRET=<stripe production webhook secret>
RESEND_API_KEY=<production Resend key>
HELP_CONTACT_FROM_EMAIL=<production verified sender>
HELP_CONTACT_TO_EMAIL=<production inbox>
ADMIN_USER_IDS=<single owner Supabase Auth UUID>
ADMIN_AUDIT_HMAC_SECRET=<32 bytes or longer production random secret>
AI_PROVIDER=openai
OPENAI_API_KEY=<production key>
OPENAI_TRANSCRIPTION_MODEL=gpt-realtime-whisper
OPENAI_TRANSCRIPTION_DELAY=high
OPENAI_CLASSIFIER_MODEL=gpt-5.4-nano
OPENAI_ANSWER_MODEL=gpt-5.6-luna
OPENAI_RESEARCH_MODEL=gpt-5.6-terra
OPENAI_COMPANY_RESEARCH_MODEL=gpt-5.6-sol
OPENAI_INTERVIEW_LEARNING_MODEL=gpt-5.6-sol
AI_MOCK_MODE=false
```

Build Variablesの変更は次回buildまで反映されません。Runtime Variables / Secretsも
StagingとProductionへ個別に設定し、変更後は対象Workerを再デプロイして確認します。

## Supabase Auth URL設定

ProductionのSupabase Dashboardで、Auth -> URL Configurationを次のように設定します。

- Site URL: `https://www.yell-for-you.jp`
- Redirect URLs:
  - `https://www.yell-for-you.jp/auth/confirm`
  - `https://www.yell-for-you.jp/auth/callback`
  - `https://www.yell-for-you.jp/auth/reset-password`

Confirm signupメールテンプレートは、標準の `{{ .ConfirmationURL }}` を使うか、独自リンクの場合は `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/profile` を使います。空のhref、`about:blank`、`{{ .RedirectTo }}` だけのリンクは使わないでください。

## Supabase migration適用

Staging:

```bash
supabase login
supabase link --project-ref <staging-project-ref>
supabase db push
```

Productionは明示許可が出るまで実行しません。

Production実行時:

```bash
supabase link --project-ref <production-project-ref>
supabase db push
```

## 初期rate card投入

`supabase/migrations/202606240001_multi_user_tokens.sql` に `default-v1` の初期rate card投入が含まれます。`supabase/migrations/202606240004_openai_pricing_rate_card.sql` でOpenAI API向けの `default-v2` を有効化します。係数変更は `token_rate_cards` に新versionを追加し、既存行を上書きしないでください。

## Stripe決済とPayout設定

1. Stripe Dashboardでアカウントを有効化し、事業者情報と本人確認を完了します。
2. Payout settingsで売上受取用の銀行口座を設定します。アプリには銀行口座番号を保存しません。
3. 日本のStripeアカウントでは日次入金は利用できません。標準は手動入金で、週次または月次入金も選択できます。
4. Staging WorkerはStripe test modeの `STRIPE_SECRET_KEY` とStaging用webhook secretを使います。
5. ProductionはStripe live modeの `STRIPE_SECRET_KEY` とProduction webhook secretを使います。
6. Webhook endpointは `/api/stripe/webhook` です。最低限 `checkout.session.completed` と `checkout.session.async_payment_succeeded` を送信対象にします。
7. Checkout Session IDごとに `stripe_checkout_grants` へ記録してから `grant_purchased_tokens` を呼ぶため、Stripe webhookが再送されても二重付与されません。

## テストユーザー作成

Supabase DashboardのAuthenticationからStaging用に2ユーザーを作成し、メール確認済みにします。

```env
RLS_USER_A_EMAIL=
RLS_USER_A_PASSWORD=
RLS_USER_B_EMAIL=
RLS_USER_B_PASSWORD=
```

## テストトークン付与CLI

```bash
SUPABASE_URL=<staging url> \
SUPABASE_SERVICE_ROLE_KEY=<staging service key> \
npm run tokens:grant-test -- --user <auth-user-uuid> --amount 300000
```

## expired reservation解放

`wrangler.jsonc` はCloudflare Cron Triggerを `*/5 * * * *` に設定しています。
`cloudflare-worker.ts` のScheduled Handlerは同じWorker内の
`/api/admin/reconcile-token-reservations` を呼び、`CRON_SECRET` が未設定ならfail closed
します。StagingとProductionで別々の `CRON_SECRET` を使ってください。CronはUTCで
評価され、設定変更の反映には時間がかかる場合があります。

StagingでScheduled Handlerを有効にする前、または手動検証する場合はCLIか、
`Authorization: Bearer $CRON_SECRET` で保護された管理APIを使います。

CLI:

```bash
SUPABASE_URL=<staging url> \
SUPABASE_SERVICE_ROLE_KEY=<staging service key> \
npm run tokens:release-expired -- --limit 100
```

Staging Workerでの手動HTTP:

```bash
curl -X POST https://<staging-worker>.<subdomain>.workers.dev/api/admin/reconcile-token-reservations \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":100}'
```

この処理は `status='reserved' and expires_at < now()` だけを `for update skip locked` で処理するため、複数回実行しても二重返却されません。

## workers.devへの先行デプロイ

Productionのcustom domainを切り替える前に、必ず本番と分離したStaging Workerへ
デプロイします。現在の `wrangler.jsonc` は `workers_dev: true`、
`preview_urls: false` です。StagingはProductionとは異なるWorker名とSecretsを使う
専用設定を用意し、Production Workerを共同編集者のPreviewとして流用しません。
ローカルからdeployする場合は、StagingのBuild VariablesをGit管理外のローカル環境へ
設定してからbuildします。Workers Buildsを使う場合は、Staging WorkerのBuild Variables
へ登録します。

```bash
cp wrangler.jsonc wrangler.staging.jsonc
# wrangler.staging.jsonc の name / service / URLをStaging用に変更する
npm run build:cloudflare
npm run preview
npm run deploy:staging
```

割り当てられた `workers.dev` URLで、Build Variablesとruntime SecretsがすべてStagingを
指していることを確認します。Supabase StagingのRedirect URLsとStripe test modeの
Webhook endpointには、このURLを一時的に追加します。本番データや本番鍵は使いません。

## Staging検証

```bash
npm run typecheck
npm run lint
npm run test
npm run build:cloudflare

SUPABASE_URL=<staging url> \
SUPABASE_ANON_KEY=<staging anon key> \
RLS_USER_A_EMAIL=... \
RLS_USER_A_PASSWORD=... \
RLS_USER_B_EMAIL=... \
RLS_USER_B_PASSWORD=... \
npm run supabase:verify-rls

npm run e2e
```

## Production custom domain切替

Stagingの `workers.dev` 検証完了後にProduction Workerをデプロイし、Cloudflareの
Custom Domainへ `www.yell-for-you.jp` を割り当てます。既存の同名CNAMEがある場合は、
切替時に競合するCNAMEを削除してからCustom Domainを有効化します。切替と同時に次を
本番URLへ揃えます。

- Supabase AuthのSite URLと許可済みRedirect URLs
- Stripe live modeのWebhook endpoint
  `https://www.yell-for-you.jp/api/stripe/webhook` と、そのendpoint用
  `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SITE_URL=https://www.yell-for-you.jp`

Cloudflare上でログイン、認証メール、パスワード再設定、Checkout、Webhook、AI API、
管理画面のオーナー限定認可、Scheduled Handlerを確認するまで旧Vercel deploymentは
停止・削除しません。ただし旧Vercel側へ新規トラフィックを分散せず、切替中に二重の
Cron実行が起きないよう旧側のCronを無効化します。

## Production移行時のrollback

1. Production適用前にGit tagを作成します。
   ```bash
   git tag production-before-multi-user-YYYYMMDD <commit>
   git push origin production-before-multi-user-YYYYMMDD
   ```
2. Cloudflare Workerまたはcustom domainで重大な問題が出た場合、CloudflareのCustom
   Domainを外し、切替前のDNSレコードを復元して維持中のVercel deploymentへ戻します。
3. 復旧後はVercel側CronとCloudflare Scheduled Handlerのどちらか一方だけを有効に
   し、二重実行を避けます。
4. DB migration後のrollbackが必要な場合は、SupabaseのPITRまたは事前backupから復元します。RLS/関数だけの問題なら追加migrationで権限を閉じる方を優先します。
5. Production DBに破壊的DROPを含むmigrationは、このPhaseでは作りません。
