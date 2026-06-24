import { beforeEach, describe, expect, it } from "vitest";

import { POST as classifyQuestion } from "@/app/api/classify-question/route";
import { POST as generateAnswer } from "@/app/api/generate-answer/route";
import { POST as importProfileFile } from "@/app/api/import-profile-file/route";
import { POST as learnInterviewContext } from "@/app/api/learn-interview-context/route";
import { POST as realtimeSession } from "@/app/api/realtime-session/route";
import { POST as researchCompany } from "@/app/api/research-company/route";
import {
  createEmptyCompanyProfile,
  createEmptyUserProfile,
} from "@/lib/schemas/interview";
import { resetTestTokenState } from "@/lib/tokens/service";

const testUserId = "00000000-0000-4000-8000-000000000001";

describe("API routes in mock mode", () => {
  beforeEach(() => {
    process.env.AI_MOCK_MODE = "true";
    process.env.TEST_AUTH_USER_ID = testUserId;
    process.env.TOKEN_TEST_MODE = "true";
    resetTestTokenState(testUserId, 100000);
  });

  it("rejects unauthenticated protected API calls", async () => {
    delete process.env.TEST_AUTH_USER_ID;

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

    expect(response.status).toBe(401);
  });

  it("does not run AI work when app token balance is insufficient", async () => {
    resetTestTokenState(testUserId, 0);

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

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({
      error: "トークン残高が不足しています。現在の残高をご確認ください。",
    });
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
          companyDetails:
            "社風: 現場課題に深く入り、顧客の業務改善を重視する。\n採用情報: プロダクト職で課題設定力を重視。\nhttps://example.com/recruit",
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

  it("imports a profile file in mock mode", async () => {
    const response = await importProfileFile(
      new Request("http://localhost/api/import-profile-file", {
        method: "POST",
        body: JSON.stringify({
          fileName: "profile.md",
          fileText:
            "私はSatoFCで野生動物追跡システムを開発し、自治体調整から実装まで担当しました。強みは粘り強くやり抜く力です。",
          currentProfile: createEmptyUserProfile(),
        }),
      }),
    );

    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toMatchObject({
      label: "メインプロフィール",
      selfText: expect.stringContaining("SatoFC"),
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

  it("returns a bounded realtime reservation in mock mode", async () => {
    process.env.APP_REALTIME_SESSION_RESERVATION_SECONDS = "10";

    const response = await realtimeSession(
      new Request("http://localhost/api/realtime-session", {
        method: "POST",
      }),
    );

    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toMatchObject({
      reservationSeconds: 10,
      reservationExpiresAt: expect.any(String),
    });
  });
});
