import {
  buildLearningProfileKey,
  MAX_LEARNING_PROFILES,
} from "@/lib/learning/freshness";
import type {
  CompanyProfile,
  PreInterviewLearning,
  UserProfile,
} from "@/lib/schemas/interview";

// 面接前メモ（/api/learn-interview-context）をブラウザから作る共通処理。
// 会社スロット作成直後の自動学習と、面接ページの学習パネルの両方から使う。
export async function requestInterviewLearning({
  profiles,
  company,
  language,
  signal,
}: {
  profiles: UserProfile[];
  company: CompanyProfile;
  language: PreInterviewLearning["language"];
  signal?: AbortSignal;
}): Promise<PreInterviewLearning> {
  const usedProfiles = profiles.slice(0, MAX_LEARNING_PROFILES);
  const response = await fetch("/api/learn-interview-context", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-operation-id": crypto.randomUUID(),
      "x-request-id": crypto.randomUUID(),
    },
    body: JSON.stringify({
      profile: usedProfiles[0] ?? null,
      profiles: usedProfiles,
      company,
      selfInfo: "",
      desiredCourse: company.targetRole ?? "",
      additionalNotes: company.interviewFocus ?? "",
      learningLanguage: language,
    }),
    signal,
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error ?? "面接前学習に失敗しました");
  }
  const data = (await response.json()) as {
    brief: string;
    keyPoints: string[];
    caution: string | null;
  };
  return {
    brief: data.brief,
    keyPoints: data.keyPoints,
    caution: data.caution,
    learnedAt: new Date().toISOString(),
    companyId: company.id,
    language,
    companyUpdatedAt: company.updatedAt,
    profileIds: usedProfiles.map((profile) => profile.id),
    profileKey: buildLearningProfileKey(usedProfiles),
  };
}
