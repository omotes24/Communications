import { describe, expect, it } from "vitest";

import {
  buildQuickAnswerDraft,
  quickDraftDelayMs,
} from "@/lib/answer/quick-draft";
import {
  createEmptyCompanyProfile,
  createEmptyUserProfile,
} from "@/lib/schemas/interview";

describe("quick answer draft", () => {
  it("creates a provisional answer from registered context within the 3 second rule", () => {
    const draft = buildQuickAnswerDraft({
      question: "志望動機を教えてください。",
      category: "motivation",
      profile: {
        ...createEmptyUserProfile(),
        careerSummary: "SatoFCで野生動物追跡システムを社会実装した",
        strengths: "現場課題を聞き取り、実装までやり切る力",
      },
      company: {
        ...createEmptyCompanyProfile(),
        companyName: "サンプル株式会社",
        targetRole: "ビジネス職",
        researchSummary: "顧客課題に向き合う事業を展開している",
      },
      learningBrief: "現場実装経験と顧客課題解決の接点を整理済み。",
    });

    expect(quickDraftDelayMs).toBeLessThanOrEqual(1800);
    expect(draft.answer).toContain("SatoFC");
    expect(draft.answer).toContain("サンプル株式会社");
    expect(draft.answer).not.toContain("未登録");
    expect(draft.answer.length).toBeGreaterThan(120);
    expect(draft.talkingPoints).toHaveLength(3);
  });

  it("creates a direct answer for a short tricky question", () => {
    const draft = buildQuickAnswerDraft({
      question: "なぜ弊社ですか？",
      category: "other",
      profile: {
        ...createEmptyUserProfile(),
        careerSummary: "野生動物追跡システムを現地実装した",
        strengths: "相手の課題を聞き取り、使える形まで改善する力",
      },
      company: {
        ...createEmptyCompanyProfile(),
        companyName: "サンプル株式会社",
        targetRole: "総合職",
        researchSummary: "現場起点で新しい価値を作る事業",
      },
      learningBrief: "",
    });

    expect(draft.answer).toContain("サンプル株式会社");
    expect(draft.answer).toContain("志望");
    expect(draft.answer).not.toContain("不足");
    expect(draft.answer.length).toBeGreaterThan(120);
  });
});
