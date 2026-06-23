# QuestionTurbo

## ようこそ「QuestionTurbo」へ。

日本語の面接で使う回答案・話すポイント提示ツールです。回答の自動代行、自動音声回答、Zoom/Google Meet への自動入力、隠し表示、ステルス表示は実装しません。

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## 環境変数

`.env.local` に設定します。API キーはサーバー側 Route Handler でだけ参照し、クライアント JavaScript、localStorage、ログへ出しません。

```bash
AI_PROVIDER=groq
GROQ_API_KEY=

GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
GROQ_STRUCTURED_MODEL=openai/gpt-oss-20b
GROQ_ANSWER_MODEL=openai/gpt-oss-120b
GROQ_RESEARCH_MODEL=groq/compound

AI_MOCK_MODE=false
```

AI API を呼ばずに E2E を実行する場合は `AI_MOCK_MODE=true` を使います。

## 画面

- 初期設定
- ユーザー情報登録
- 企業・求人情報登録
- 面接
- セッション履歴
- データ削除・プライバシー設定

## 音声と個人情報の扱い

- 生音声は標準保存しません。
- セッション終了時に取得済み MediaStreamTrack を停止します。
- 文字起こし履歴は標準では保存しません。
- 回答画面で明示的に保存した場合だけセッション履歴へ保存します。
- 「すべてのデータを削除」で localStorage のアプリデータを削除します。

## AI API へ送信される情報

- Transcription: ブラウザで共有したマイクまたはタブ/画面音声
- 質問判定: 確定した文字起こし、発話者種別、入力元
- 回答生成: 認識した質問、質問カテゴリー、登録済みユーザー情報、登録済み企業・求人情報

## Google Meet タブ音声

Google Meet の相手側音声を拾う場合は、Safari ではなく Chrome または Edge を使います。Meet はデスクトップアプリではなく、ブラウザタブで開いてください。

1. Chrome で Google Meet を開き、面接ルームに入ります。
2. 同じ Chrome の別タブで `http://127.0.0.1:3000/support` を開きます。
3. QuestionTurbo の面接画面で「タブ・画面音声を共有」を押します。
4. Chrome の共有ダイアログで「Chrome タブ」を選び、`meet.google.com` のタブを選択します。
5. 「タブの音声も共有」または「Share tab audio」が有効になっていることを確認して共有します。
6. 画面上部に `meet.google.com をこのタブに共有しています` と出ていれば、Meet の相手側音声が文字起こし対象になります。

「画面全体」や「ウィンドウ」を選ぶと、Mac/Chrome の設定によって音声が付かないことがあります。相手側音声を安定して拾うには、必ず Meet の「Chrome タブ」を共有します。

## Zoom デスクトップ音声

Phase 1 では Zoom デスクトップアプリのシステム音声取得は保証しません。ブラウザタブ音声、または手動質問入力を使ってください。

## テスト

```bash
npm run typecheck
npm run lint
npm test
npm run e2e
```

E2E は `AI_MOCK_MODE=true` の開発サーバーを自動起動し、AI API を直接呼びません。

## 既知の制約

- PDF、Word、Web ページ読み込みは Phase 2 の拡張対象です。
- 音声共有の可否はブラウザと OS の権限・実装に依存します。
- ライブ文字起こしの検証には有効な Groq または OpenAI API キーが必要です。
- 回答案の事実性は登録情報とプロンプト制約で抑制しますが、本人確認なしでの利用は想定していません。

## 今後の拡張候補

- PDF/Word/求人 URL 取り込み
- 回答品質の評価ログ
- セッション別メトリクスの集計
- 履歴の暗号化保存
