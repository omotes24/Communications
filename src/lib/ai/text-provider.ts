// サーバーとブラウザの両方から読む、テキスト生成プロバイダの表示用設定。
// （src/lib/openai/env.ts は server-only なので、ここに共通の定数と判定を置く）

// Vercel AI Gateway 上の inception/mercury-3 は 2026-12-28 05:05 UTC に提供終了予定。
// その少し前に既定のプロバイダへ戻す。
export const DEFAULT_MERCURY_DISABLE_AFTER = "2026-12-28T00:00:00+09:00";

export type PublicTextProvider = "openai" | "groq" | "mercury";

export function resolvePublicTextProvider({
  textProvider,
  baseProvider,
  mercuryDisableAfter,
  now = Date.now(),
}: {
  textProvider?: string;
  baseProvider?: string;
  mercuryDisableAfter?: string;
  now?: number;
}): PublicTextProvider {
  const base: PublicTextProvider = baseProvider === "groq" ? "groq" : "openai";
  if (textProvider === "mercury") {
    const disableAt = Date.parse(
      mercuryDisableAfter || DEFAULT_MERCURY_DISABLE_AFTER,
    );
    return Number.isNaN(disableAt) || now < disableAt ? "mercury" : base;
  }
  if (textProvider === "groq" || textProvider === "openai") {
    return textProvider;
  }
  return base;
}

export const answerModelLabels: Record<
  PublicTextProvider,
  {
    standard: { label: string; description: string };
    fermi: { label: string; description: string };
  }
> = {
  mercury: {
    standard: { label: "Mercury 3", description: "高速" },
    fermi: { label: "Mercury 3", description: "高精度" },
  },
  groq: {
    standard: { label: "Groq 20B", description: "高速" },
    fermi: { label: "Groq 120B", description: "高精度" },
  },
  openai: {
    standard: { label: "5.6 Luna", description: "高速" },
    fermi: { label: "5.6 Terra", description: "高精度" },
  },
};
