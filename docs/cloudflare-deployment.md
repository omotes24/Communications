# Cloudflare Workers移行・本番デプロイ手順

Yell for You 1.3は、Next.jsをOpenNextで変換してCloudflare Workersへデプロイします。
いきなり `www.yell-for-you.jp` を切り替えず、Stagingの `workers.dev` で検証してから
Production Workerへcustom domainを割り当てます。

## 変更しない安全ルール

- StagingとProductionは、Cloudflare Worker、Supabase project、Stripe mode、OpenAI
  keyを分離する。
- Cloudflare Productionアカウント、Production Worker、Production Secretsへアクセス
  できるのはオーナーだけとする。共同編集者へCloudflare Production権限を渡さない。
- ProductionのWorkers BuildsをGitHub連携する場合は、owner review必須の保護された
  `main` だけをProduction deploy元にし、共同編集者のbranchを自動deployしない。
- `ADMIN_USER_IDS` はProductionオーナーのSupabase Auth UUIDを1件だけ登録する。
- ProductionのService Role、Stripe Secret、OpenAI key、ユーザーデータをStagingへ
  コピーしない。
- Cloudflareで本番検証が完了するまで既存Vercel deploymentをrollback専用として維持
  する。新規デプロイ先や定常運用先としては使わない。
- SecretをGitHub、Codexの会話、ログ、`wrangler.jsonc` へ書かない。

## リポジトリ内のCloudflare構成

| ファイル               | 役割                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `open-next.config.ts`  | OpenNextのCloudflare設定                                    |
| `wrangler.jsonc`       | Worker entry point、runtime variables、Assets、Cron Trigger |
| `cloudflare-worker.ts` | OpenNext WorkerとScheduled Handlerのentry point             |
| `public/_headers`      | 静的assetのcache header                                     |

現在の `wrangler.jsonc` は `workers_dev: true`、`preview_urls: false` です。そのため、
custom domainを接続する前に固定の `workers.dev` endpointで確認できます。Stagingには
`yell-for-you-staging` などProductionと異なるWorker名を使い、同じWorkerのSecretsを
差し替えて共用しません。

## 事前条件

1. Node.js 22以上を使います。
2. `yell-for-you.jp` をCloudflareのactive zoneとして管理できることを確認します。
3. オーナーのCloudflareアカウントでMFAを有効にします。
4. 現在のminify済みbundleはWebpack buildでgzip後約1.63 MiBとなり、Free planの
   3 MiB上限内です。Productionの実負荷でCPU時間などのFree plan上限に達する場合は
   Workers Paidへ変更します。
5. Staging用とProduction用のSupabase、Stripe、OpenAI設定を先に準備します。

## Build Variablesとruntime bindingsを分ける

`NEXT_PUBLIC_*` はNext.jsのbuild時にブラウザbundleへ埋め込まれます。Cloudflare
Workers Buildsを使う場合は、各WorkerのBuild Variablesへ次を登録します。

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_NAME
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_PRODUCT_ANALYTICS_ENABLED
```

ローカルから `npm run deploy:staging` または `npm run deploy:production` する場合、
Cloudflare DashboardのBuild Variablesは
ローカルbuildへ自動注入されません。対象環境の値をGit管理外のローカル環境へ設定して
からbuildします。Production値を使ったartifactをStagingへ、Staging値を使ったartifactを
Productionへ送らないでください。

実行時の非機密値は `wrangler.jsonc` の `vars` で管理します。現在の設定が要求する
runtime Secretsは次の9件です。

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
CRON_SECRET
ADMIN_USER_IDS
ADMIN_AUDIT_HMAC_SECRET
```

上の2つの `NEXT_PUBLIC_SUPABASE_*` は公開クライアント設定ですが、現在のWorker設定では
runtime bindingとしても必要です。Build Variablesと対象Workerのruntimeの両方へ同じ
環境の値を登録します。残り7件はブラウザへ渡さないサーバー専用値です。

Secretは値を引数や標準出力へ出さず、対象Workerを明示して対話入力します。

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name <worker-name>
npx wrangler secret put OPENAI_API_KEY --name <worker-name>
npx wrangler secret put STRIPE_SECRET_KEY --name <worker-name>
npx wrangler secret put STRIPE_WEBHOOK_SECRET --name <worker-name>
npx wrangler secret put CRON_SECRET --name <worker-name>
npx wrangler secret put ADMIN_USER_IDS --name <worker-name>
npx wrangler secret put ADMIN_AUDIT_HMAC_SECRET --name <worker-name>
```

問い合わせメールを有効にする場合だけ、同じWorkerへ `RESEND_API_KEY`、
`HELP_CONTACT_FROM_EMAIL`、`HELP_CONTACT_TO_EMAIL` を追加します。未設定時は問い合わせAPIが
503でfail closedし、他の画面・認証・面接機能には影響しません。

`NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` も同じ対象Workerへruntime
bindingとして登録します。StagingではStaging用UUIDと乱数を使い、Productionオーナーの
UUIDやProductionのHMAC secretを再利用しません。

## 1. ローカルでCloudflare buildを検証する

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build:cloudflare
npm run preview
```

`npm run preview` はworkerd上で動かす本番相当のローカル確認です。通常の
`next dev` だけで移行可否を判断しません。

Production buildは意図的に `next build --webpack` を使います。同じアプリをNext.js 16の
既定Turbopackでbuildするとserver chunkの重複によりgzip約3.18 MiBとなりましたが、
Webpackでは約1.63 MiBです。bundlerを変更する場合は、必ず `wrangler deploy --dry-run` の
gzip値が3 MiB未満であることを確認します。

CIは `npm run check:cloudflare-size` で同じdry-run値を検査します。gzip 2.7 MiBで警告し、
Free plan上限の3 MiBを超えた場合はPRを失敗させます。

## 2. Stagingをworkers.devへデプロイする

1. Productionと別名のStaging Workerを作ります。
2. Workers Buildsを使う場合はBuild VariablesへStaging値を設定します。ローカルから
   deployする場合は、同じ値をGit管理外のローカル環境へ設定します。
3. Staging Workerのruntime Variables / SecretsへStaging値だけを設定します。
4. Git管理外の専用 `wrangler.staging.jsonc` を作ります。Production設定をそのまま
   デプロイせず、`name` と `WORKER_SELF_REFERENCE` の `service` を同じStaging Worker名、
   `NEXT_PUBLIC_SITE_URL` を実際のStaging URLへ変更します。
   現在の標準scriptはCloudflare向けにbuildし、Dashboardで管理しているvars/secretsを
   `--keep-vars` で保持します。

```bash
cp wrangler.jsonc wrangler.staging.jsonc
# wrangler.staging.jsonc の name / service / URLをStaging用に変更する
npm run deploy:staging
```

Workers Buildsを使う場合は、Staging Workerに対してbuild commandを
`npm run build:cloudflare`、deploy commandを
`npx opennextjs-cloudflare deploy -- --keep-vars` に設定します。Production用のBuildsは
保護された `main` 以外から起動しません。

5. 発行された `https://<staging-worker-name>.<subdomain>.workers.dev` をSupabase
   StagingのRedirect URLsとStripe test modeのWebhook endpointへ一時的に追加します。

`preview_urls: false` はランダムなversion preview URLを無効にしますが、
`workers_dev: true` の固定 `workers.dev` endpointは検証に使えます。

### Staging確認項目

- トップ、料金、利用規約、プライバシー画面が表示できる。
- Stagingユーザーの登録、確認メール、ログイン、ログアウト、パスワード再設定が動く。
- Supabase RLSで別ユーザーのデータを読めない。
- Stripe test Checkoutと署名付きWebhookが1回だけtokenを付与する。
- OpenAI経由の文字起こし、回答生成、会社・面接前学習が動く。
- Staging ownerだけがホームの管理ボタンと `/admin`、`/admin/analytics` を利用できる。
  一般ユーザーの管理ページ直アクセスはホームへ戻り、管理APIは404を返す。
- `wrangler.jsonc` のCron TriggerとScheduled Handlerが動き、期限切れ予約を解放する。
- ログへSecret、メール、プロンプト、生音声、全文文字起こしが出ていない。

Staging検証にProductionユーザーやProductionオーナーでログインしません。

## 3. Production Workerをworkers.devで確認する

Staging合格後、オーナーがProduction WorkerへProduction専用のBuild VariablesとSecretsを
登録してデプロイします。この時点ではcustom domainを接続せず、`workers.dev` で公開
画面、静的asset、外部API接続、ログとbundle制限を確認します。Production Authを
使う確認は、許可済みredirectの範囲を必要最小限にし、確認後に一時URLを削除します。

Production Workerの `ADMIN_USER_IDS` はオーナーのSupabase Auth UUID 1件だけ、
`ADMIN_AUDIT_HMAC_SECRET` は32バイト以上のProduction専用乱数にします。

## 4. SupabaseとStripeの本番callbackを確定する

Supabase ProductionのAuth設定を次へ揃えます。

```text
Site URL: https://www.yell-for-you.jp
Redirect URLs:
  https://www.yell-for-you.jp/auth/confirm
  https://www.yell-for-you.jp/auth/callback
  https://www.yell-for-you.jp/auth/reset-password
```

Stripe live modeのWebhook endpointは次です。

```text
https://www.yell-for-you.jp/api/stripe/webhook
```

送信対象には少なくとも `checkout.session.completed` と
`checkout.session.async_payment_succeeded` を含め、作成した本番endpoint固有の署名
secretをProduction Workerの `STRIPE_WEBHOOK_SECRET` へ登録します。StagingのWebhook
secretを流用しません。

## 5. custom domainをCloudflare Workerへ切り替える

1. 切替前のDNSレコード、Vercel deployment、Supabase Auth設定、Stripe webhook設定を
   記録します。
2. 旧Vercel側のCronを無効にし、Cloudflareと同時実行されないようにします。
3. Cloudflare WorkersのCustom DomainsでProduction Workerへ
   `www.yell-for-you.jp` を割り当てます。
4. 同じhostnameに既存CNAMEがある場合、Custom Domainと競合するため切替時にその
   CNAMEを削除します。Cloudflareが作るCustom Domain用DNS recordを手動で重複作成
   しません。
5. TLSが有効になったことを確認し、本番URLでログイン、Supabase callback、Stripe
   Webhook、AI API、管理画面、静的assetを再確認します。
6. 一般ユーザーと共同編集者ではホームに管理ボタンが出ず、`/admin` と
   `/admin/analytics` の直アクセスはホームへ戻り、管理APIは404になることを別セッション
   で確認します。
7. 本番custom domainでの確認後、`wrangler.jsonc` の `workers_dev` を `false` にして
   `npm run deploy:production` を再実行し、代替の `workers.dev` endpointを閉じます。

旧Vercelへトラフィックを分散する並行稼働は行いません。Cloudflareが合格するまで
rollback先としてdeploymentだけを保持し、合格後にVercelの本番運用を終了します。

## Scheduled Handler / Cron

`wrangler.jsonc` の `*/5 * * * *` は5分ごとにUTCで実行されます。
`cloudflare-worker.ts` のScheduled Handlerは、同じWorker内の
`/api/admin/reconcile-token-reservations` を `Authorization: Bearer <CRON_SECRET>` 付きで
呼びます。`CRON_SECRET` がない場合やRoute Handlerが成功しない場合はfail closedします。

Cron設定の反映には時間がかかる場合があります。Cloudflareのlogsで成功を確認し、同じ
Production DBに対するVercel Cronや外部schedulerを同時に有効化しません。

## rollback

Cloudflareへの切替後に重大な問題が見つかった場合は、次の順序で戻します。

1. Cloudflare Scheduled Handlerを止めます。
2. Production WorkerのCustom Domainを外します。
3. 記録しておいたVercel向けDNS recordを復元します。
4. Vercel deploymentのhealthと認証callbackを確認してから、必要な場合だけ旧Cronを
   再開します。
5. Supabase / Stripe設定をrollback先URLへ戻し、ログインとWebhookを確認します。

rollback中もschedulerは必ず一系統だけ動かします。Cloudflareの本番検証が完了して
安定運用へ移った後は、Vercelの環境変数、Cron、deploymentを整理してCloudflareのみを
本番系とします。
