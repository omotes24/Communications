export function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();

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
  if (normalized.includes("rate limit")) {
    return "認証処理を受け付けられませんでした。時間をおいて再度お試しください。";
  }

  return "認証処理に失敗しました。入力内容を確認してください。";
}
