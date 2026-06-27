import { describe, expect, it } from "vitest";

import {
  analyzeGroupDiscussionUtterance,
  refreshGroupDiscussionSessionAnalysis,
} from "@/lib/group-discussion/analysis";
import type { GroupDiscussionSessionRecord } from "@/lib/schemas/groupDiscussion";

function createSession(): GroupDiscussionSessionRecord {
  const now = new Date().toISOString();
  return {
    id: "gd-unit",
    mode: "solo",
    status: "active",
    topic: "新規サービスの優先施策を決める",
    topicCategory: "ビジネス",
    durationMinutes: 20,
    userRole: "参加者",
    participants: [
      {
        id: "user",
        name: "あなた",
        role: "参加者",
        stance: "整理する",
        type: "user",
      },
    ],
    utterances: [
      {
        id: "utt-1",
        sessionId: "gd-unit",
        speakerId: "user",
        speakerName: "あなた",
        speakerType: "user",
        text: "まず前提を整理して、評価基準を決めませんか。",
        source: "text",
        startedAt: now,
        endedAt: now,
        durationSeconds: 7,
        analysis: null,
      },
      {
        id: "utt-2",
        sessionId: "gd-unit",
        speakerId: "user",
        speakerName: "あなた",
        speakerType: "user",
        text: "結論として、短期は検証しやすい施策に絞るのがよいです。",
        source: "text",
        startedAt: now,
        endedAt: now,
        durationSeconds: 8,
        analysis: null,
      },
    ],
    discussionMap: {
      nodes: [],
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
}

describe("group discussion analysis", () => {
  it("classifies questions and issue organization", () => {
    const analysis = analyzeGroupDiscussionUtterance({
      text: "まず前提を整理して、評価基準を決めませんか。",
    });

    expect(analysis.isQuestion).toBe(true);
    expect(analysis.issueOrganization).toBe(true);
    expect(analysis.progress).toBe("advance");
  });

  it("creates metrics and evidence-backed map nodes", () => {
    const refreshed = refreshGroupDiscussionSessionAnalysis(createSession());

    expect(refreshed.metrics?.questionCount.evidenceUtteranceIds).toContain(
      "utt-1",
    );
    expect(
      refreshed.metrics?.conclusionContribution.evidenceUtteranceIds,
    ).toContain("utt-2");
    expect(refreshed.discussionMap.nodes.some((node) => node.id === "topic")).toBe(
      true,
    );
    expect(
      refreshed.discussionMap.nodes.some((node) =>
        node.evidenceUtteranceIds.includes("utt-1"),
      ),
    ).toBe(true);
  });
});
