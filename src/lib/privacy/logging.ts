const API_KEY_PATTERN = /\b(sk-(?:proj|svc|admin)?-[A-Za-z0-9_-]{12,})\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?\d[\d -]{8,}\d)/g;

function toProviderFriendlyError(message: string): string | null {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("exceeded your current quota") ||
    normalized.includes("insufficient_quota") ||
    normalized.includes("usage limit") ||
    normalized.includes("billing")
  ) {
    return [
      "AI API の利用枠または請求設定により実行できません。",
      "利用中プロバイダのBilling / Usage Limitsで支払い方法、月次予算、残高を確認してください。",
      "動作確認だけなら .env.local の AI_MOCK_MODE=true にしてサーバーを再起動すると、AI API を呼ばずに使えます。",
    ].join(" ");
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("429")
  ) {
    return [
      "AI API のレート制限に達しました。",
      "少し待ってから再実行してください。連続実行しても失敗リクエストが制限に加算されるため、時間を空ける必要があります。",
    ].join(" ");
  }

  return null;
}

export function maskSensitiveText(input: unknown): string {
  const text =
    typeof input === "string" ? input : (JSON.stringify(input, null, 2) ?? "");
  return text
    .replace(API_KEY_PATTERN, "[MASKED_API_KEY]")
    .replace(EMAIL_PATTERN, "[MASKED_EMAIL]")
    .replace(PHONE_PATTERN, "[MASKED_PHONE]");
}

export function toPublicError(error: unknown): string {
  if (error instanceof Error) {
    return (
      toProviderFriendlyError(error.message) ?? maskSensitiveText(error.message)
    );
  }
  return "予期しないエラーが発生しました";
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: maskSensitiveText(message) }, { status });
}
