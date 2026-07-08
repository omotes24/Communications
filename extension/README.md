# Yell for You Webテストを自動で解く Chrome Extension

Manifest V3 のMVPです。OpenAI APIキーは含めず、検知した問題JSONやスクリーンショットを本体アプリの `/api/solve-question` に送ります。

## Load unpacked

1. Chromeで `chrome://extensions` を開く
2. Developer mode を有効化
3. Load unpacked でこの `extension/` ディレクトリを選択

API送信先はサイドパネル上部の「API」欄で変更・保存できます（既定値は `http://localhost:3000`。本番は `https://www.yell-for-you.jp`）。

## スクショ解答（範囲選択）

DOMから問題を検知できないページでも、画面の見た目から解答できます。

- **スクショで解く**: 初回はページ上をドラッグして範囲を選択 → その範囲だけを切り抜いてAPIへ送信。
  選択した範囲は「リセット」を押すまで保持され、2回目以降はワンクリックで同じ範囲を撮り直して解答します。
- **範囲を選び直す**: 範囲を選択し直してから解答します。
- **リセット**: 保存された範囲を消去します（以降のスクショは画面全体）。
- 検知済みの問題カードにある「スクショで解く」も、範囲が保存されていればその切り抜きを添付します。
- 範囲選択はEscで中止できます。選択UIはスクリーンショットには写り込みません。

## 認証

APIへの送信はブラウザのCookie（Supabaseセッション）を使います。本番APIを使う場合は、
同じChromeで本体サイトにログインしておいてください。ローカル開発では
`.env.local` の `LOCAL_AUTH_BYPASS=true` によりログイン不要です。
