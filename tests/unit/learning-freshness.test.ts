import { describe, expect, it } from "vitest";

import { resolvePublicTextProvider } from "@/lib/ai/text-provider";
import { guessQuestionCategory } from "@/lib/answer/category-guess";
import {
  buildLearningProfileKey,
  getLearningFreshness,
} from "@/lib/learning/freshness";
import { buildInterviewLearningInput } from "@/lib/prompts/interview-learning";
import {
  createEmptyCompanyProfile,
  createEmptyUserProfile,
  type PreInterviewLearning,
} from "@/lib/schemas/interview";

function profile(id: string, label: string, updatedAt: string) {
  return { ...createEmptyUserProfile(), id, label, updatedAt };
}

function company(id: string, companyName: string, updatedAt: string) {
  return {
    ...createEmptyCompanyProfile(),
    id,
    label: companyName,
    companyName,
    updatedAt,
  };
}

function learning(
  overrides: Partial<PreInterviewLearning> = {},
): PreInterviewLearning {
  return {
    brief: "memo",
    keyPoints: [],
    caution: null,
    learnedAt: "2026-07-13T07:40:34.031Z",
    companyId: "company-1",
    language: "ja",
    ...overrides,
  };
}

describe("pre-interview learning freshness", () => {
  const profileD = profile(
    "p-d",
    "ベイカレント自己紹介",
    "2026-11-22T00:30:09.984Z",
  );
  const baycurrent = company(
    "company-1",
    "ベイカレント",
    "2026-11-22T00:34:26.579Z",
  );

  it("treats a memo learned before the company slot was overwritten as stale", () => {
    // 7月に三井住友信託銀行向けに作ったメモが、同じスロットIDのまま残っていた本番のケース。
    expect(
      getLearningFreshness({
        learning: learning(),
        company: baycurrent,
        profiles: [profileD],
        language: "ja",
      }),
    ).toBe("companyChanged");
  });

  it("treats a memo as current only for the same company version and self slots", () => {
    const memo = learning({
      learnedAt: "2026-11-22T00:40:00.000Z",
      companyUpdatedAt: baycurrent.updatedAt,
      profileKey: buildLearningProfileKey([profileD]),
    });
    expect(
      getLearningFreshness({
        learning: memo,
        company: baycurrent,
        profiles: [profileD],
        language: "ja",
      }),
    ).toBe("current");

    const profileA = profile(
      "p-a",
      "三井住友信託銀行",
      "2026-07-10T03:22:55.490Z",
    );
    expect(
      getLearningFreshness({
        learning: memo,
        company: baycurrent,
        profiles: [profileA],
        language: "ja",
      }),
    ).toBe("profileChanged");

    expect(
      getLearningFreshness({
        learning: memo,
        company: { ...baycurrent, updatedAt: "2026-11-23T00:00:00.000Z" },
        profiles: [profileD],
        language: "ja",
      }),
    ).toBe("companyChanged");

    expect(
      getLearningFreshness({
        learning: memo,
        company: baycurrent,
        profiles: [profileD],
        language: "en",
      }),
    ).toBe("otherLanguage");
  });

  it("falls back to learnedAt for legacy memos without version fields", () => {
    const olderProfile = profile("p-a", "A", "2026-07-01T00:00:00.000Z");
    const olderCompany = company("company-1", "X", "2026-07-01T00:00:00.000Z");
    expect(
      getLearningFreshness({
        learning: learning(),
        company: olderCompany,
        profiles: [olderProfile],
        language: "ja",
      }),
    ).toBe("current");
    expect(
      getLearningFreshness({
        learning: learning(),
        company: olderCompany,
        profiles: [profileD],
        language: "ja",
      }),
    ).toBe("profileChanged");
  });

  it("reports missing or other-company memos", () => {
    expect(
      getLearningFreshness({
        learning: null,
        company: baycurrent,
        profiles: [profileD],
        language: "ja",
      }),
    ).toBe("missing");
    expect(
      getLearningFreshness({
        learning: learning({ companyId: "other" }),
        company: baycurrent,
        profiles: [profileD],
        language: "ja",
      }),
    ).toBe("otherCompany");
  });
});

describe("interview learning prompt", () => {
  it("uses every selected self slot and names the target company", () => {
    const first = {
      ...profile("p-1", "ベイカレント自己紹介", "2026-11-22T00:00:00.000Z"),
      careerSummary: "SatoFCで現地ヒアリングから運用改善まで担当",
    };
    const second = {
      ...profile("p-2", "研究", "2026-11-22T00:00:00.000Z"),
      careerSummary: "分布外検知の研究",
    };
    const input = buildInterviewLearningInput({
      profile: first,
      profiles: [first, second],
      company: company("company-1", "ベイカレント", "2026-11-22T00:00:00.000Z"),
      selfInfo: "",
      desiredCourse: "システムコンサルタント職",
      additionalNotes: "",
      learningLanguage: "ja",
    });
    expect(input).toContain("応募企業: ベイカレント");
    expect(input).toContain("SatoFCで現地ヒアリングから運用改善まで担当");
    expect(input).toContain("分布外検知の研究");
    expect(input).toContain("志望コース: システムコンサルタント職");
  });
});

describe("question category guess", () => {
  it("guesses common interview categories without waiting for the classifier", () => {
    expect(guessQuestionCategory("まず簡単に自己紹介をお願いします。")).toBe(
      "introduction",
    );
    expect(
      guessQuestionCategory("なぜコンサルタントを志望しているのですか？"),
    ).toBe("motivation");
    expect(
      guessQuestionCategory("学生時代に最も力を入れたことを教えてください。"),
    ).toBe("experience");
    expect(
      guessQuestionCategory("日本にある電柱の本数を推定してください。"),
    ).toBe("case");
    expect(guessQuestionCategory("今日はよろしくお願いします。")).toBe("other");
  });
});

describe("public text provider label", () => {
  it("shows Mercury until the shutdown date, then the base provider", () => {
    expect(
      resolvePublicTextProvider({
        textProvider: "mercury",
        baseProvider: "openai",
        now: Date.parse("2026-11-22T00:00:00+09:00"),
      }),
    ).toBe("mercury");
    expect(
      resolvePublicTextProvider({
        textProvider: "mercury",
        baseProvider: "openai",
        now: Date.parse("2026-12-28T00:00:01+09:00"),
      }),
    ).toBe("openai");
    expect(resolvePublicTextProvider({ baseProvider: "groq" })).toBe("groq");
    expect(resolvePublicTextProvider({})).toBe("openai");
  });
});
