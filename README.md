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
OPENAI_API_KEY=sk-...
OPENAI_TRANSCRIPTION_MODEL=gpt-realtime-whisper
OPENAI_CLASSIFIER_MODEL=gpt-5.4-nano
OPENAI_ANSWER_MODEL=gpt-5.5-mini
OPENAI_RESEARCH_MODEL=gpt-5.5
OPENAI_MOCK_MODE=false
```

OpenAI を呼ばずに E2E を実行する場合は `OPENAI_MOCK_MODE=true` を使います。

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

## OpenAI API へ送信される情報

- Realtime transcription: ブラウザで共有したマイクまたはタブ/画面音声
- 質問判定: 確定した文字起こし、発話者種別、入力元
- 回答生成: 認識した質問、質問カテゴリー、登録済みユーザー情報、登録済み企業・求人情報

## Google Meet タブ音声

面接画面で「タブ・画面音声を共有」を押し、ブラウザの共有ダイアログで Meet のタブとタブ音声を選択します。相手側音声の取得を主前提にしています。

## Zoom デスクトップ音声

Phase 1 では Zoom デスクトップアプリのシステム音声取得は保証しません。ブラウザタブ音声、または手動質問入力を使ってください。

## テスト

```bash
npm run typecheck
npm run lint
npm test
npm run e2e
```

E2E は `OPENAI_MOCK_MODE=true` の開発サーバーを自動起動し、OpenAI API を直接呼びません。

## 既知の制約

- PDF、Word、Web ページ読み込みは Phase 2 の拡張対象です。
- 音声共有の可否はブラウザと OS の権限・実装に依存します。
- Realtime transcription のライブ検証には有効な OpenAI API キーが必要です。
- 回答案の事実性は登録情報とプロンプト制約で抑制しますが、本人確認なしでの利用は想定していません。

## 今後の拡張候補

- PDF/Word/求人 URL 取り込み
- 回答品質の評価ログ
- セッション別メトリクスの集計
- 履歴の暗号化保存
