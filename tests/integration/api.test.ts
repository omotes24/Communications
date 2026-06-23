import { beforeEach, describe, expect, it } from "vitest";

import { POST as classifyQuestion } from "@/app/api/classify-question/route";
import { POST as generateAnswer } from "@/app/api/generate-answer/route";
import { POST as learnInterviewContext } from "@/app/api/learn-interview-context/route";
import { POST as researchCompany } from "@/app/api/research-company/route";
import {
  createEmptyCompanyProfile,
  createEmptyUserProfile,
} from "@/lib/schemas/interview";

describe("API routes in mock mode", () => {
  beforeEach(() => {
    process.env.AI_MOCK_MODE = "true";
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

  it("researches a company slot in mock mode", async () => {
    const response = await researchCompany(
      new Request("http://localhost/api/research-company", {
        method: "POST",
        body: JSON.stringify({
          selfInfo: "SatoFCで野生動物追跡システムを実装した",
          companyName: "サンプル株式会社",
          companyWebsite: "https://example.com/recruit",
          desiredCourse: "A職 Bコース",
          additionalNotes: "現場実装経験を接続したい",
        }),
      }),
    );

    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toMatchObject({
      companyName: "サンプル株式会社",
      targetRole: "A職 Bコース",
      researchSources: ["https://example.com/recruit"],
    });
  });

  it("creates a pre-interview learning memo in mock mode", async () => {
    const response = await learnInterviewContext(
      new Request("http://localhost/api/learn-interview-context", {
        method: "POST",
        body: JSON.stringify({
          profile: createEmptyUserProfile(),
          company: createEmptyCompanyProfile(),
          selfInfo: "SatoFCの現場実装経験",
          desiredCourse: "A職 Bコース",
          additionalNotes: "深掘り質問を想定",
        }),
      }),
    );

    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toMatchObject({
      keyPoints: expect.any(Array),
    });
  });
});
