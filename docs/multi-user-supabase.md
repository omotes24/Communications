# Yell for You 1.1 Multi-user Setup

## Supabase

1. Supabase projectを作成します。
2. SQL editor または Supabase CLI で `supabase/migrations/202606240001_multi_user_tokens.sql` を適用します。
3. AuthenticationのEmail providerを有効にし、Site URLをVercel本番URLへ設定します。
4. Redirect URLsに以下を追加します。
   - `http://localhost:3000/auth/callback`
   - `https://<your-domain>/auth/callback`
5. Project Settingsから `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` を取得します。

## Vercel

Vercel Environment Variablesに次を設定します。

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

AI_PROVIDER=groq
GROQ_API_KEY=
OPENAI_API_KEY=
AI_MOCK_MODE=false

APP_SIGNUP_GRANT_TOKENS=0
APP_REALTIME_SESSION_RESERVATION_SECONDS=180
```

`SUPABASE_SERVICE_ROLE_KEY`、`OPENAI_API_KEY`、`GROQ_API_KEY` はサーバー側だけで使用します。`NEXT_PUBLIC_` の付いたSupabase公開設定以外をブラウザへ送らないでください。

## Local Development

```bash
npm ci
npm run dev
```

ローカルでもSupabase Authを使う場合は `.env.local` に `.env.example` と同じキーを設定してください。

## Data Migration

既存ブラウザの `jp-interview-assistant:v1` は、初回ログイン後に同意ダイアログを表示します。

同意した場合だけ `/api/storage/import-local` へ送信し、`local_storage_imports` の `import_id` と `migration_version` で二重移行を防止します。同意しない限り既存localStorageデータはサーバーに送信しません。

## Token Model

アプリ内トークンはOpenAI/Groqの生API tokenとは別物です。

- 残高は `token_wallets` のBIGINT整数で管理します。
- AI実行前に `reserve_tokens` で最大消費量を予約します。
- 成功後にusageからアプリ内トークンを算出し、`settle_tokens` で確定します。
- 失敗時は `release_token_reservation` で予約を戻します。
- 消費係数は `token_rate_cards` で管理します。

## Security Notes

- 保護ページはmiddlewareでログイン必須です。
- AI/API routeでも `requireApiUser()` によりサーバー側sessionを確認します。
- user_idはクライアント入力を信用せず、認証済みsessionから取得します。
- RLSはユーザーデータごとに `auth.uid() = user_id` を原則にしています。
- `token_ledger` はtriggerで更新・削除を禁止しています。
- prompt全文、ES全文、音声全文はusageログに保存しません。

## Not Implemented

今回の実装では決済画面、Stripe、Apple In-App Purchase、Google Play Billing、購入パック、円価格は未実装です。将来のWebhookはサーバー側で検証後、`grant_tokens` を呼び出す構造にしてください。
