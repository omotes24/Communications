const API_KEY_PATTERN = /\b(sk-(?:proj|svc|admin)?-[A-Za-z0-9_-]{12,})\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?\d[\d -]{8,}\d)/g;

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
    return maskSensitiveText(error.message);
  }
  return "予期しないエラーが発生しました";
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: maskSensitiveText(message) }, { status });
}
