# 管理ダッシュボード運用手順

経営管理画面は `/admin`、Webアクセス分析は `/admin/analytics` です。管理者以外にはページ・APIとも一律404を返すため、機能の存在を判別できません。管理者アカウントはメールアドレスではなく、変更されにくい Supabase Auth の user UUID で指定します。

## 友人を管理者として登録する

1. 友人本人に、通常のYell for You新規登録画面から自分専用のアカウントを作成してもらいます。パスワードや確認メールを共有しないでください。
2. 友人に確認メールを開いて認証を完了し、一度ログインしてもらいます。
3. オーナーが Supabase Dashboard の `Authentication` → `Users` を開き、対象ユーザーのメールアドレスを確認します。
4. 対象行の `User UID`（UUID）をコピーします。メールアドレスではありません。
5. VercelのProject Settings → Environment Variablesで `ADMIN_USER_IDS` にUUIDを登録します。複数人はカンマ区切りです。

   ```text
   ADMIN_USER_IDS=owner-uuid,friend-uuid
   ```

6. Productionと必要なPreview環境を選び、再デプロイします。
7. 友人がログインした状態で `/admin` を直接開き、管理画面が見えることを確認します。一般ユーザーでは404になることも別アカウントで確認します。

## 推奨する追加環境変数

```text
ADMIN_AUDIT_HMAC_SECRET=<32バイト以上のランダム値>
OPENAI_USD_JPY_RATE=150
OPENAI_WEB_SEARCH_USD_PER_CALL=0.01
NEXT_PUBLIC_PRODUCT_ANALYTICS_ENABLED=false
INTERVIEW_EXPERIENCE_ENABLED=false
```

- `ADMIN_AUDIT_HMAC_SECRET` は管理画面とCSVの匿名IDを安定させます。本番投入後は不用意に変更しないでください。
- 為替レートは推定原価の円換算に使います。実際の請求照合時に更新してください。
- 行動分析は既定で無効です。有効化すると、公開プライバシー画面の説明・ブラウザ別オプトアウト・DNT/GPC尊重の方針に従って収集します。生データの保持期間は90日です。
- 面接体験談・過去問は準備機能です。通常ユーザーへ公開しない間は必ず `false` のままにします。有効にしても管理者限定です。

## 権限を取り消す

`ADMIN_USER_IDS` から対象UUIDを削除して再デプロイします。本人の通常アカウントを残したまま管理権限だけを外せます。退職・紛失時はSupabase Auth側のセッション失効も行ってください。

## 運用上の注意

- 共有管理者アカウントは作らず、一人一アカウントにします。
- 友人へVercel、Supabase Service Role、Stripe Secret、OpenAI APIキーを渡す必要はありません。
- `ADMIN_EMAILS` は既存環境からの移行専用です。新規管理者には使いません。
- CSVにはメール、氏名、生のプロンプト、生音声、全文文字起こしを含めません。
