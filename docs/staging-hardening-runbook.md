# 本番化前監査 / Staging導入 Runbook

## 最終アプリ名とBundle ID候補

- App name: `Yell for You 1.2`
- iOS Bundle ID候補: `jp.omotes.yellforyou`
- Android applicationId候補: `jp.omotes.yellforyou`
- Web production domain候補: `yell-for-you.app` または現行Vercel domain

Capacitor、iOS、Android、Apple In-App Purchase、Google Play BillingはこのPhaseでは追加しません。Web決済はStripe Checkoutで処理します。

## 人間が先に行う設定

1. Supabase projectを2つ作成します。
   - `Yell for You 1.2 Staging`
   - `Yell for You 1.2 Production`
2. 認証メール用SMTPを契約・設定します。
   - 推奨候補: Resend、Postmark、Amazon SES
   - Supabase標準メール配信のまま一般公開しないでください。
3. Vercel Environment Variablesを分離します。
   - Preview -> Supabase Staging
   - Production -> Supabase Production
4. 秘密鍵はCodex会話欄へ貼らず、Vercelとローカル `.env.local` に直接設定します。

## Vercel Preview環境変数

```env
NEXT_PUBLIC_SUPABASE_URL=<staging url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging anon key>
NEXT_PUBLIC_APP_NAME=Yell for You 1.2
NEXT_PUBLIC_SITE_URL=<preview deployment url>
SUPABASE_SERVICE_ROLE_KEY=<staging service role key>
SUPABASE_STORAGE_BUCKETS=
APP_SIGNUP_GRANT_TOKENS=300000
APP_REALTIME_SESSION_RESERVATION_SECONDS=180
CRON_SECRET=<preview manual admin secret>
STRIPE_SECRET_KEY=<stripe test secret key>
STRIPE_WEBHOOK_SECRET=<stripe preview webhook secret>
AI_PROVIDER=openai
OPENAI_API_KEY=<staging/test key>
OPENAI_TRANSCRIPTION_MODEL=gpt-realtime-whisper
OPENAI_CLASSIFIER_MODEL=gpt-5.4-nano
OPENAI_ANSWER_MODEL=gpt-5.4-mini
OPENAI_RESEARCH_MODEL=gpt-5.5
AI_MOCK_MODE=false
```

## Vercel Production環境変数

```env
NEXT_PUBLIC_SUPABASE_URL=<production url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production anon key>
NEXT_PUBLIC_APP_NAME=Yell for You 1.2
NEXT_PUBLIC_SITE_URL=https://communications-umber.vercel.app
SUPABASE_SERVICE_ROLE_KEY=<production service role key>
SUPABASE_STORAGE_BUCKETS=
APP_SIGNUP_GRANT_TOKENS=0
APP_REALTIME_SESSION_RESERVATION_SECONDS=180
CRON_SECRET=<production cron secret>
STRIPE_SECRET_KEY=<stripe live secret key>
STRIPE_WEBHOOK_SECRET=<stripe production webhook secret>
AI_PROVIDER=openai
OPENAI_API_KEY=<production key>
OPENAI_TRANSCRIPTION_MODEL=gpt-realtime-whisper
OPENAI_CLASSIFIER_MODEL=gpt-5.4-nano
OPENAI_ANSWER_MODEL=gpt-5.4-mini
OPENAI_RESEARCH_MODEL=gpt-5.5
AI_MOCK_MODE=false
```

環境変数変更は既存デプロイへ反映されません。Preview/Productionとも再デプロイが必要です。

## Supabase Auth URL設定

ProductionのSupabase Dashboardで、Auth -> URL Configurationを次のように設定します。

- Site URL: `https://communications-umber.vercel.app`
- Redirect URLs:
  - `https://communications-umber.vercel.app/auth/confirm`
  - `https://communications-umber.vercel.app/auth/callback`

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
4. Staging/PreviewはStripe test modeの `STRIPE_SECRET_KEY` とPreview用webhook secretを使います。
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

Vercel CronはProduction deploymentのURLだけを定期実行します。Preview deploymentはVercel Cronで定期実行されないため、Staging PreviewではCLI、または `Authorization: Bearer $CRON_SECRET` で保護された管理APIから手動実行してください。

CLI:

```bash
SUPABASE_URL=<staging url> \
SUPABASE_SERVICE_ROLE_KEY=<staging service key> \
npm run tokens:release-expired -- --limit 100
```

Staging Previewでの手動HTTP:

```bash
curl -X POST https://<preview-domain>/api/admin/reconcile-token-reservations \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":100}'
```

ProductionでVercel Cronを設定する場合、Vercelは `CRON_SECRET` の値を `Authorization: Bearer <CRON_SECRET>` として送信します。Route Handlerはこの `Authorization` ヘッダーだけを検証し、secret未設定時はfail closedします。

この処理は `status='reserved' and expires_at < now()` だけを `for update skip locked` で処理するため、複数回実行しても二重返却されません。

## Previewデプロイ

```bash
git push origin codex/staging-hardening-auth-tokens
```

VercelがPreview deploymentを作成します。Preview環境変数がStaging Supabaseを指していることを確認してください。

## Staging検証

```bash
npm run typecheck
npm run lint
npm run test
npm run build

SUPABASE_URL=<staging url> \
SUPABASE_ANON_KEY=<staging anon key> \
RLS_USER_A_EMAIL=... \
RLS_USER_A_PASSWORD=... \
RLS_USER_B_EMAIL=... \
RLS_USER_B_PASSWORD=... \
npm run supabase:verify-rls

npm run e2e
```

## Production移行時のrollback

1. Production適用前にGit tagを作成します。
   ```bash
   git tag production-before-multi-user-YYYYMMDD <commit>
   git push origin production-before-multi-user-YYYYMMDD
   ```
2. Vercelは直前のProduction DeploymentへPromote/Rollbackします。
3. DB migration後のrollbackが必要な場合は、SupabaseのPITRまたは事前backupから復元します。RLS/関数だけの問題なら追加migrationで権限を閉じる方を優先します。
4. Production DBに破壊的DROPを含むmigrationは、このPhaseでは作りません。
