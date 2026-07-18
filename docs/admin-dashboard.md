# オーナー専用管理画面と共同編集の運用手順

経営管理画面は `/admin`、Webアクセス分析は `/admin/analytics` です。アクセス数、
売上、購入数、利用量、原価などの経営管理情報は `kotaro3150@keio.jp` の単一
オーナーだけが閲覧できます。この制約を共同編集の利便性より常に優先します。

## アプリ側の認可

Cloudflare Production WorkerのSecret `ADMIN_USER_IDS` には、オーナーのSupabase Auth `User UID`
（UUID）を1件だけ登録します。

```text
ADMIN_USER_IDS=<owner-supabase-user-uuid>
```

サーバーは次の条件をすべて満たしたときだけ管理画面と管理APIを許可します。

1. `ADMIN_USER_IDS` が正しいUUIDを1件だけ含む
2. Supabase Authで検証されたログインセッションである
3. ログイン中ユーザーのUUIDがその値と一致する
4. ログイン中ユーザーのメールが `kotaro3150@keio.jp` と一致する

設定なし、不正なUUID、複数UUID、UUIDだけの一致、メールだけの一致はすべて拒否
します。旧 `ADMIN_EMAILS`、テスト認証、ローカル認証バイパスでは管理権限を付与
しません。

## 拒否時の表示とXYZ文言

管理画面へ非オーナーが直接アクセスした場合は、管理情報を一切描画せず、固定文言
`XYZキーが必要です。` だけを表示します。管理APIは同じ文言を含む403応答を返し、
データベースやService Roleへ到達しません。管理APIとCSVは
`private, no-store`、`Vary: Cookie`、`noindex` とします。管理画面のHTMLとRSCにも
`private, no-store` と `noindex` を適用し、App Routerが必要とする `Vary` 値は
上書きしません。

XYZは不正なアクセスをオーナーへ申告させるための案内文言であり、実在する認証キー
ではありません。入力欄、環境変数、URLパラメータ、HTTPヘッダー、Cookie、POST本文
によるXYZ照合や権限昇格は実装しません。Cloudflare Cronの
`/api/admin/reconcile-token-reservations` は人間向け管理APIではなく、実在する
`CRON_SECRET` のBearer認証だけを使用します。

## 共同編集者へ渡す権限

共同編集者にはGitHubリポジトリの作業ブランチ作成とPR作成だけを許可します。

| 対象                         | 共同編集者 | オーナー |
| ---------------------------- | ---------- | -------- |
| GitHub作業ブランチ・PR       | 可         | 可       |
| `main` への取り込み          | 不可       | 可       |
| Cloudflare Production Worker | 不可       | 可       |
| Supabase Production          | 不可       | 可       |
| Stripe / OpenAI / 本番秘密鍵 | 不可       | 可       |
| `/admin` と管理API           | 不可       | 可       |

`.github/CODEOWNERS` とPR検査だけでは強制にならないため、GitHubの `main`
rulesetでも次を設定します。

- Pull requestを必須にする
- Code ownerの承認を必須にする
- 新しいコミット時に古い承認を無効化する
- PR作成者以外による最新コミットの承認を必須にする
- `PR Security Gate` の成功を必須にする
- `Sole Owner Approval` の成功を必須にする
- force pushとブランチ削除を禁止する
- 共同編集者をbypass対象へ追加しない

共同編集者をCloudflare本番アカウントや本番Supabaseプロジェクトへ招待してはいけません。
本番デプロイ権限がある人は、管理画面の認可コードを変更したりService Roleを使う
コードをデプロイできるため、アプリ内のアクセス制御だけでは情報を守れません。

## Preview / Staging

共同編集者による動作確認が必要なら、本番と別のCloudflare Worker、Supabase
プロジェクト、Stripeテスト環境を使います。本番のService Role、Stripe Secret、
OpenAIキー、ユーザーデータをPreviewへ渡しません。オーナーアカウントで共同編集者の
Previewへログインもしません。

## 本番環境変数

```text
ADMIN_USER_IDS=<owner-supabase-user-uuid>
ADMIN_AUDIT_HMAC_SECRET=<32バイト以上のランダム値>
OPENAI_USD_JPY_RATE=150
OPENAI_WEB_SEARCH_USD_PER_CALL=0.01
NEXT_PUBLIC_PRODUCT_ANALYTICS_ENABLED=false
INTERVIEW_EXPERIENCE_ENABLED=false
```

`ADMIN_AUDIT_HMAC_SECRET` は管理画面とCSVの匿名IDを安定させます。本番投入後は
不用意に変更しません。32バイト未満または未設定の場合、統計とCSVは匿名IDを単純な
ハッシュへフォールバックせず、データ取得前にfail-closedします。行動分析は、
プライバシー表示、保持期間、同意方針を確認したうえで有効にします。面接体験談・
過去問は公開準備が整うまで `false` のままにします。

## アカウント防御

- オーナーアカウントは共有しない
- Supabase AuthとCloudflareでMFAを有効にする
- パスワードが会話、画面共有、ログへ出た場合は直ちに変更する
- パスワード変更時は既存セッションも失効させる
- CSVにはメール、氏名、生のプロンプト、生音声、全文文字起こしを含めない

共同編集を終了するときはGitHubの共同編集権限を削除します。通常ユーザーアカウントを
残したままでも、上記の単一オーナー認可により管理権限は付与されません。
