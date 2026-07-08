# SolveSnap — Yell for You Chrome Extension

Manifest V3 のMVPです。OpenAI APIキーは含めず、検知した問題JSONやスクリーンショットを
本体アプリ（`https://communications-umber.vercel.app`）の `/api/solve-question` に送ります。

## Load unpacked

1. Chromeで `chrome://extensions` を開く
2. Developer mode を有効化
3. Load unpacked でこの `extension/` ディレクトリを選択

API送信先はソース内の定数（`background/serviceWorker.js`の`API_BASE_URL`）で
`https://communications-umber.vercel.app` に固定されており、UIで変更する設定は
一切置いていません。トークン課金残高を使う一般ユーザー向けの拡張機能のため、
ローカルサーバーやGatewayへ向ける手段は存在しません。

## スクショ解答（サイドパネル内プレビュー）

サイドパネル上部に**現在のタブのライブプレビュー**が表示されます（約1.5秒ごとに自動更新）。
DOMから問題を検知できないページでも、画面の見た目から解答できます。

1. プレビュー上を**ドラッグ**して問題部分を切り抜く（黄色の枠）
2. 「**解く**」を押すと、最新の画面を撮り直して**枠の内側だけ**をAPIへ送信
3. 切り抜き範囲は「**範囲リセット**」を押すまで維持されるので、
   次の問題へ進んだら「解く」を押すだけで同じ範囲を再解答できます
4. 範囲未選択のときは画面全体を送信します

検知済みの問題カードにある「スクショで解く」も、範囲があればその切り抜きを添付します。
プレビューは chrome:// などの特殊ページでは表示できません。

## 認証

APIへの送信はブラウザのCookie（Supabaseセッション）を使います。同じChromeで
`https://communications-umber.vercel.app` にログインしておいてください。
