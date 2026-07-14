import "server-only";

/**
 * 将来機能は通常ユーザーへ存在を知らせない。明示的に有効化されるまで
 * API は 404 を返し、UI からも参照しない。
 */
export function isInterviewExperienceEnabled(): boolean {
  return process.env.INTERVIEW_EXPERIENCE_ENABLED === "true";
}

