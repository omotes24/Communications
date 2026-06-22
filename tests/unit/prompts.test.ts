import { describe, expect, it } from "vitest";

import {
  buildAnswerInput,
  buildAnswerInstructions,
} from "@/lib/prompts/answer";
import { buildQuestionClassifierInput } from "@/lib/prompts/classifier";

describe("prompts", () => {
  it("contains anti-fabrication rules", () => {
    const prompt = buildAnswerInstructions();
    expect(prompt).toContain("必ず回答本文を書く");
    expect(prompt).toContain("自然な面接回答になる範囲で一般化して補う");
    expect(prompt).toContain("回答本文には、根拠不足");
    expect(prompt).toContain("evidenceUsed");
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
    });

    expect(input).toContain("直近会話");
    expect(input).toContain("野生動物追跡システム");
    expect(input).toContain("最も意思決定が難しかった場面");
  });
});
