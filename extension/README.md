# Yell for You Webテストを自動で解く Chrome Extension

Manifest V3 のMVPです。OpenAI APIキーは含めず、検知した問題JSONだけを本体アプリの `/api/solve-question` に送ります。

## Load unpacked

1. Chromeで `chrome://extensions` を開く
2. Developer mode を有効化
3. Load unpacked でこの `extension/` ディレクトリを選択

API送信先の既定値は `https://www.yell-for-you.jp` です。開発中に変更する場合は、拡張のstorageで `apiBaseUrl` を変更してください。
