import { beforeEach, describe, expect, it } from "vitest";

import { POST as classifyQuestion } from "@/app/api/classify-question/route";
import { POST as generateAnswer } from "@/app/api/generate-answer/route";
import {
  createEmptyCompanyProfile,
  createEmptyUserProfile,
} from "@/lib/schemas/interview";

describe("API routes in mock mode", () => {
  beforeEach(() => {
    process.env.OPENAI_MOCK_MODE = "true";
  });

  it("classifies a simulated transcript", async () => {
    const response = await classifyQuestion(
      new Request("http://localhost/api/classify-question", {
        method: "POST",
        body: JSON.stringify({
          transcript: "これまでの経験について教えてください",
          speaker: "remote",
          source: "remote-audio",
        }),
      }),
    );

    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toMatchObject({
      isQuestion: true,
      category: "experience",
    });
  });

  it("streams a structured answer", async () => {
    const profile = {
      ...createEmptyUserProfile(),
      currentRole: "事業開発",
      strengths: "顧客課題を整理して提案に落とす力",
      achievements: "新規商談化率を改善",
    };
    const company = {
      ...createEmptyCompanyProfile(),
      companyName: "サンプル株式会社",
      attraction: "顧客の業務改善に深く関われる点",
    };

    const response = await generateAnswer(
      new Request("http://localhost/api/generate-answer", {
        method: "POST",
        body: JSON.stringify({
          question: "志望動機を教えてください。",
          category: "motivation",
          profile,
          company,
        }),
      }),
    );

    expect(response.ok).toBe(true);
    const text = await response.text();
    expect(text).toContain("event: partial");
    expect(text).toContain("event: done");
    expect(text).toContain("サンプル株式会社");
  });
});
