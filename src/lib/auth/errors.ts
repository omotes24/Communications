export function isAuthThrottleError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("rate limit") ||
    normalized.includes("too many") ||
    normalized.includes("security purposes") ||
    normalized.includes("email rate") ||
    normalized.includes("request this after")
  );
}

export function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (isAuthThrottleError(message)) {
    return "認証処理に失敗しました。入力内容を確認してください。";
  }

  if (normalized.includes("invalid login credentials")) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }
  if (normalized.includes("email not confirmed")) {
    return "メールアドレス確認が完了していません。受信メールを確認してください。";
  }
  if (normalized.includes("user already registered")) {
    return "このメールアドレスはすでに登録されています。";
  }
  if (normalized.includes("password")) {
    return "パスワードの条件を確認してください。";
  }

  return "認証処理に失敗しました。入力内容を確認してください。";
}
