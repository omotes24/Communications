import type {
  CompanyProfile,
  PreInterviewLearning,
  UserProfile,
} from "@/lib/schemas/interview";

// 面接前メモ（storage.learning）は1件だけ保存される。
// 会社スロットを別の会社で上書きしても id は変わらないため、id 一致だけで「学習済み」と
// 判定すると古い会社向けのメモが回答に混ざる。会社スロットの更新時刻と、学習に使った
// 自分スロットの組み合わせまで一致したときだけ「現在のメモ」として扱う。

export const MAX_LEARNING_PROFILES = 8;

export type LearningFreshness =
  | "current"
  | "missing"
  | "otherCompany"
  | "otherLanguage"
  | "companyChanged"
  | "profileChanged";

export function buildLearningProfileKey(
  profiles: Pick<UserProfile, "id" | "updatedAt">[],
): string {
  return profiles
    .map((profile) => `${profile.id}@${profile.updatedAt}`)
    .sort()
    .join("|");
}

function isAfter(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) {
    return false;
  }
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return false;
  }
  return leftTime > rightTime;
}

export function getLearningFreshness({
  learning,
  company,
  profiles,
  language,
}: {
  learning: PreInterviewLearning | null | undefined;
  company: CompanyProfile | null | undefined;
  profiles: UserProfile[];
  language: PreInterviewLearning["language"];
}): LearningFreshness {
  if (!learning) {
    return "missing";
  }
  if (!company || learning.companyId !== company.id) {
    return "otherCompany";
  }
  if (learning.language !== language) {
    return "otherLanguage";
  }

  if (learning.companyUpdatedAt !== undefined) {
    if (learning.companyUpdatedAt !== company.updatedAt) {
      return "companyChanged";
    }
  } else if (isAfter(company.updatedAt, learning.learnedAt)) {
    return "companyChanged";
  }

  const usedProfiles = profiles.slice(0, MAX_LEARNING_PROFILES);
  if (learning.profileKey !== undefined) {
    if (learning.profileKey !== buildLearningProfileKey(usedProfiles)) {
      return "profileChanged";
    }
  } else if (
    usedProfiles.some((profile) =>
      isAfter(profile.updatedAt, learning.learnedAt),
    )
  ) {
    return "profileChanged";
  }

  return "current";
}

export function isLearningCurrent(
  args: Parameters<typeof getLearningFreshness>[0],
): boolean {
  return getLearningFreshness(args) === "current";
}

export function describeStaleLearning(freshness: LearningFreshness): string {
  switch (freshness) {
    case "companyChanged":
      return "会社スロットが更新されたため、面接前メモを作り直します。";
    case "profileChanged":
      return "使用する自分スロットが変わったため、面接前メモを作り直します。";
    case "otherLanguage":
      return "面接の言語が変わったため、面接前メモを作り直します。";
    case "otherCompany":
      return "この会社の面接前メモはまだありません。";
    case "missing":
      return "面接前メモはまだありません。";
    default:
      return "";
  }
}
