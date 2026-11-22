import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // 回答モデル切り替えボタンの表示名（Mercury / 5.6 Luna など）を、
  // サーバー側の AI_TEXT_PROVIDER と同じ設定から決めるためにブラウザへ渡す。秘密情報は含まない。
  env: {
    NEXT_PUBLIC_AI_TEXT_PROVIDER: process.env.AI_TEXT_PROVIDER ?? "",
    NEXT_PUBLIC_MERCURY_DISABLE_AFTER: process.env.MERCURY_DISABLE_AFTER ?? "",
  },
};

export default nextConfig;
