import { describe, expect, it } from "vitest";

import {
  answerDraftSchema,
  countJapaneseCharacters,
  questionClassificationSchema,
  validateAnswerLength,
} from "@/lib/schemas/interview";

describe("interview schemas", () => {
  it("validates question classification schema", () => {
    const parsed = questionClassificationSchema.parse({
      isQuestion: true,
      confidence: 0.95,
      question: "自己紹介をお願いします。",
      category: "introduction",
      requiresPersonalExample: false,
      reason: "回答要求です",
    });

    expect(parsed.isQuestion).toBe(true);
  });

  it("validates answer draft schema", () => {
    const parsed = answerDraftSchema.parse({
      question: "経験を教えてください。",
      talkingPoints: ["結論", "具体例", "成果"],
      answer: "回答案",
      evidenceUsed: ["職歴"],
      missingInformation: [],
      caution: null,
    });

    expect(parsed.talkingPoints).toHaveLength(3);
  });

  it("counts Japanese characters without whitespace", () => {
    expect(countJapaneseCharacters("あ い\nう")).toBe(3);
    expect(countJapaneseCharacters("**重要** な回答")).toBe(5);
  });

  it("flags answers outside 250-350 characters", () => {
    expect(validateAnswerLength("短い").inRange).toBe(false);
    expect(validateAnswerLength("あ".repeat(260)).inRange).toBe(true);
    expect(validateAnswerLength("あ".repeat(850), 900).inRange).toBe(true);
  });
});
