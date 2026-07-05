import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as classifyQuestion } from "@/app/api/classify-question/route";
import { POST as generateAnswer } from "@/app/api/generate-answer/route";
import { POST as groupDiscussionAiTurn } from "@/app/api/group-discussion/ai-turn/route";
import { POST as groupDiscussionFinalize } from "@/app/api/group-discussion/finalize/route";
import { POST as groupDiscussionTopic } from "@/app/api/group-discussion/topic/route";
import { POST as importProfileFile } from "@/app/api/import-profile-file/route";
import { POST as learnInterviewContext } from "@/app/api/learn-interview-context/route";
import { POST as realtimeSession } from "@/app/api/realtime-session/route";
import { POST as researchCompany } from "@/app/api/research-company/route";
import { POST as solveQuestion } from "@/app/api/solve-question/route";
import {
  createEmptyCompanyProfile,
  createEmptyUserProfile,
} from "@/lib/schemas/interview";
import { createDefaultAiParticipants } from "@/lib/group-discussion/mock";
import type { GroupDiscussionSessionRecord } from "@/lib/schemas/groupDiscussion";
import { resetTestTokenState } from "@/lib/tokens/service";

const testUserId = "00000000-0000-4000-8000-000000000001";

describe("API routes in mock mode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AI_MOCK_MODE = "true";
    process.env.TEST_AUTH_USER_ID = testUserId;
    process.env.TOKEN_TEST_MODE = "true";
    delete process.env.OPENAI_TRANSCRIPTION_DELAY;
    delete process.env.OPENAI_AUDIO_NOISE_REDUCTION;
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

  it("does not rate limit repeated interview AI requests", async () => {
    const responses = await Promise.all(
      Array.from({ length: 75 }, (_, index) =>
        classifyQuestion(
          new Request("http://localhost/api/classify-question", {
            method: "POST",
            body: JSON.stringify({
              transcript: `これは動作確認です ${index}`,
              speaker: "local",
              source: "manual",
            }),
          }),
        ),
      ),
    );

    expect(responses.every((response) => response.status !== 429)).toBe(true);
    expect(responses.every((response) => response.ok)).toBe(true);
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

  it("solves a detected question in mock mode", async () => {
    const response = await solveQuestion(
      new Request("http://localhost/api/solve-question", {
        method: "POST",
        body: JSON.stringify({
          question: {
            questionId: "math-001",
            source: "structured_dom",
            subject: "math",
            gradeLevel: "high1",
            answerType: "single_choice",
            stem: "次の二次方程式を解きなさい。x^2 - 5x + 6 = 0",
            choices: [
              { id: "A", text: "x = 1, 6" },
              { id: "B", text: "x = 2, 3" },
            ],
            mathLatex: ["x^2 - 5x + 6 = 0"],
            rawText:
              "次の二次方程式を解きなさい。x^2 - 5x + 6 = 0 A x = 1, 6 B x = 2, 3",
            pageUrl: "https://example.com/question",
            pageTitle: "自作問題",
            confidence: 0.95,
          },
          mode: "explanation",
          language: "ja",
        }),
      }),
    );

    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toMatchObject({
      questionId: "math-001",
      detectedSubject: "math",
      answerType: "single_choice",
      selectedChoiceIds: ["A"],
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

  it("runs a group discussion mock API flow", async () => {
    const topicResponse = await groupDiscussionTopic(
      new Request("http://localhost/api/group-discussion/topic", {
        method: "POST",
        body: JSON.stringify({
          category: "金融",
          topicType: "problem_solving",
          difficulty: "standard",
          durationMinutes: 20,
          practiceMode: "realistic",
          evaluationFocus: ["logical_thinking", "decision_making"],
          companyContext: "金融インフラの安全性を重視する企業",
          profileContext: "研究で仮説検証を行った",
        }),
      }),
    );
    expect(topicResponse.ok).toBe(true);
    const topic = (await topicResponse.json()) as {
      topic: string;
      title: string;
      topic_type: "problem_solving";
      background: string;
      constraints: string[];
      deliverable: string;
      evaluation_focus: string[];
      suggested_time_allocation: string[];
      sample_good_direction: string;
      common_traps: string[];
      assumed_company_or_industry: string;
      assumptions: string[];
      expectedIssues: string[];
    };
    expect(topic.topic).toContain("金融");

    const now = new Date().toISOString();
    const session: GroupDiscussionSessionRecord = {
      id: "gd-test-session",
      mode: "ai-participants",
      practiceMode: "realistic",
      status: "active",
      topic: topic.topic,
      topicCategory: "金融",
      topicType: topic.topic_type,
      difficulty: "standard",
      durationMinutes: 20,
      userRole: "参加者",
      participants: [
        {
          id: "user",
          name: "あなた",
          role: "参加者",
          stance: "論点整理を練習する",
          type: "user",
        },
        ...createDefaultAiParticipants(),
      ],
      aiParticipantCount: 2,
      aiPersonas: ["balanced", "logical"],
      evaluationFocus: ["logical_thinking", "decision_making"],
      profileSlotIds: [],
      companySlotIds: [],
      topicDetails: {
        title: topic.title,
        background: topic.background,
        constraints: [...topic.constraints, ...topic.assumptions],
        deliverable: topic.deliverable,
        evaluationFocus: topic.evaluation_focus,
        suggestedTimeAllocation: topic.suggested_time_allocation,
        sampleGoodDirection: topic.sample_good_direction,
        commonTraps: [...topic.common_traps, ...topic.expectedIssues],
        assumedCompanyOrIndustry: topic.assumed_company_or_industry,
      },
      currentPhase: "intro",
      phaseHistory: [{ phase: "intro", startedAt: now, endedAt: null }],
      whiteboardNotes: "",
      finalAnswer: "",
      presentationText: "",
      recommendedDrills: [],
      estimatedTokenRange: {
        min: 800,
        max: 1400,
      },
      utterances: [
        {
          id: "utt-1",
          sessionId: "gd-test-session",
          speakerId: "user",
          speakerName: "あなた",
          speakerType: "user",
          text: "まず前提を整理して、継続利用と安全性を評価基準にしたいです。",
          source: "text",
          startedAt: now,
          endedAt: now,
          durationSeconds: 8,
          analysis: null,
        },
      ],
      discussionMap: {
        nodes: [
          {
            id: "topic",
            type: "topic",
            label: topic.topic,
            evidenceUtteranceIds: [],
          },
        ],
        edges: [],
      },
      metrics: null,
      finalEvaluation: null,
      saveTranscript: true,
      createdAt: now,
      startedAt: now,
      endedAt: null,
      updatedAt: now,
    };

    const aiResponse = await groupDiscussionAiTurn(
      new Request("http://localhost/api/group-discussion/ai-turn", {
        method: "POST",
        body: JSON.stringify({ session }),
      }),
    );
    expect(aiResponse.ok).toBe(true);
    await expect(aiResponse.json()).resolves.toMatchObject({
      utterance: {
        speakerType: "ai",
      },
    });

    const finalizeResponse = await groupDiscussionFinalize(
      new Request("http://localhost/api/group-discussion/finalize", {
        method: "POST",
        body: JSON.stringify({ session }),
      }),
    );
    expect(finalizeResponse.ok).toBe(true);
    await expect(finalizeResponse.json()).resolves.toMatchObject({
      metrics: {
        questionCount: expect.any(Object),
      },
      finalEvaluation: {
        totalScore: expect.any(Number),
      },
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

  it("uses accuracy-biased realtime transcription while enabling input cleanup", async () => {
    process.env.AI_MOCK_MODE = "false";
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_TRANSCRIPTION_MODEL = "gpt-realtime-whisper";
    delete process.env.OPENAI_TRANSCRIPTION_DELAY;
    delete process.env.OPENAI_AUDIO_NOISE_REDUCTION;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          value: "ephemeral-token",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const response = await realtimeSession(
      new Request("http://localhost/api/realtime-session", {
        method: "POST",
      }),
    );

    expect(response.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body));
    expect(body.session.audio.input.transcription).toMatchObject({
      model: "gpt-realtime-whisper",
      language: "ja",
      delay: "high",
    });
    expect(body.session.audio.input.transcription.prompt).toContain(
      "フェルミ推定",
    );
    expect(body.session.audio.input.noise_reduction).toEqual({
      type: "far_field",
    });
    expect(body.session.audio.input.turn_detection).toBeNull();
  });

  it("passes explicit realtime transcription tuning to OpenAI", async () => {
    process.env.AI_MOCK_MODE = "false";
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_TRANSCRIPTION_MODEL = "gpt-realtime-whisper";
    process.env.OPENAI_TRANSCRIPTION_DELAY = "medium";
    process.env.OPENAI_AUDIO_NOISE_REDUCTION = "near_field";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ value: "ephemeral-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await realtimeSession(
      new Request("http://localhost/api/realtime-session", {
        method: "POST",
      }),
    );

    expect(response.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body));
    expect(body.session.audio.input.transcription.delay).toBe("medium");
    expect(body.session.audio.input.noise_reduction).toEqual({
      type: "near_field",
    });
  });

  it("lets the client request xhigh realtime transcription for a session", async () => {
    process.env.AI_MOCK_MODE = "false";
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_TRANSCRIPTION_MODEL = "gpt-realtime-whisper";
    process.env.OPENAI_TRANSCRIPTION_DELAY = "high";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ value: "ephemeral-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await realtimeSession(
      new Request("http://localhost/api/realtime-session", {
        method: "POST",
        body: JSON.stringify({ transcriptionDelay: "xhigh" }),
      }),
    );

    expect(response.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body));
    expect(body.session.audio.input.transcription.delay).toBe("xhigh");
  });

  it("falls back when realtime transcription prompt is rejected", async () => {
    process.env.AI_MOCK_MODE = "false";
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_TRANSCRIPTION_MODEL = "gpt-realtime-whisper";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "unsupported prompt" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: "ephemeral-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const response = await realtimeSession(
      new Request("http://localhost/api/realtime-session", {
        method: "POST",
      }),
    );

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(firstBody.session.audio.input.transcription.prompt).toContain(
      "フェルミ推定",
    );
    expect(secondBody.session.audio.input.transcription.prompt).toBeUndefined();
  });
});
