import { describe, expect, it } from "vitest";

import {
  buildAnswerInput,
  buildAnswerInstructions,
} from "@/lib/prompts/answer";
import { buildQuestionClassifierInput } from "@/lib/prompts/classifier";
import {
  buildInterviewLearningInput,
  buildInterviewLearningInstructions,
} from "@/lib/prompts/interview-learning";

describe("prompts", () => {
  it("contains anti-fabrication rules", () => {
    const prompt = buildAnswerInstructions();
    expect(prompt).toContain("必ず回答本文を書く");
    expect(prompt).toContain("自然な面接回答になる範囲で一般化して補う");
    expect(prompt).toContain("回答本文には、根拠不足");
    expect(prompt).toContain("evidenceUsed");
  });

  it("contains English interview mode rules", () => {
    const prompt = buildAnswerInstructions("en");
    expect(prompt).toContain("英語面接モード");
    expect(prompt).toContain("回答本文 answer は自然な英語");
    expect(prompt).toContain("talkingPoints");
  });

  it("marks local speech in classifier input", () => {
    const input = buildQuestionClassifierInput({
      transcript: "私の回答です",
      speaker: "local",
      source: "local-mic",
    });
    expect(input).toContain("speaker: local");
  });

  it("does not mark profile and company as unregistered when a learning brief exists", () => {
    const input = buildAnswerInput({
      question: "志望動機を教えてください。",
      category: "motivation",
      profile: null,
      company: null,
      learningBrief: "SatoFCの社会実装経験と応募企業の事業接点を整理済み。",
      conversationContext: [],
      answerLanguage: "ja",
    });

    expect(input).toContain("面接前理解メモ");
    expect(input).not.toContain("未登録");
  });

  it("includes prior conversation for follow-up answers", () => {
    const input = buildAnswerInput({
      question:
        "その経験の中で、最も意思決定が難しかった場面を教えてください。",
      category: "followUp",
      profile: null,
      company: null,
      learningBrief: "",
      conversationContext: [
        {
          question: "学生時代に力を入れたことを教えてください。",
          answer: "野生動物追跡システムを現地実装した経験です。",
        },
      ],
      answerLanguage: "ja",
    });

    expect(input).toContain("直近会話");
    expect(input).toContain("野生動物追跡システム");
    expect(input).toContain("最も意思決定が難しかった場面");
  });

  it("includes answer model mode and self slot notes", () => {
    const input = buildAnswerInput({
      question: "日本のカフェ市場規模を推定してください。",
      category: "case",
      profile: null,
      company: null,
      learningBrief: "",
      conversationContext: [],
      answerLanguage: "ja",
      answerModelMode: "fermi",
      selfSlot: "東京、20代、単価は月額ではなく1回あたりで置く",
      answerLengthTarget: 700,
      profiles: [
        {
          id: "profile-a",
          label: "研究",
          nameOrAlias: "",
          affiliation: "",
          currentRole: "",
          careerSummary: "研究で推定モデルを実装",
          workHistory: "",
          skills: "",
          strengths: "",
          weaknesses: "",
          achievements: "",
          metrics: "",
          successStories: "",
          failureStories: "",
          managementExperience: "",
          careerChangeReason: "",
          motivationMaterials: "",
          preferredTone: "",
          forbiddenInformation: "",
          createdAt: "",
          updatedAt: "",
        },
      ],
      companies: [
        {
          id: "company-a",
          label: "応募先A",
          companyName: "A社",
          sourceSystem: "standalone",
          jobtrackCatalogRef: null,
          business: "",
          philosophy: "",
          targetRole: "事業開発",
          jobDescription: "",
          requiredSkills: "",
          interviewFocus: "",
          attraction: "",
          reverseQuestions: "",
          researchInput: "",
          researchInstruction: "",
          researchSummary: "",
          researchSources: [],
          fitHypotheses: [],
          interviewAngles: [],
          createdAt: "",
          updatedAt: "",
        },
      ],
    });

    expect(input).toContain("高精度 フェルミ・ケース推論");
    expect(input).toContain("目標文字数: 700文字程度");
    expect(input).toContain("自分スロット追加メモ");
    expect(input).toContain("1回あたり");
    expect(input).toContain("選択中の自分スロット");
    expect(input).toContain("選択中の会社スロット");
  });

  it("marks English answer language in answer input", () => {
    const input = buildAnswerInput({
      question: "あなたのリーダー経験を教えてください。",
      category: "experience",
      profile: null,
      company: null,
      learningBrief: "",
      conversationContext: [],
      answerLanguage: "en",
    });

    expect(input).toContain("回答言語: English");
    expect(input).toContain("回答本文は英語");
  });

  it("marks English language in interview learning prompt", () => {
    const instructions = buildInterviewLearningInstructions("en");
    const input = buildInterviewLearningInput({
      profile: null,
      company: null,
      selfInfo: "SatoFC field implementation",
      desiredCourse: "Business development",
      additionalNotes: "Use concise English",
      learningLanguage: "en",
    });

    expect(instructions).toContain("自然な英語");
    expect(input).toContain("学習メモの出力言語: English");
    expect(input).toContain("SatoFC field implementation");
  });
});
