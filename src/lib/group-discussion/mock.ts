import {
  analyzeGroupDiscussionUtterance,
  buildGroupDiscussionMap,
  calculateGroupDiscussionMetrics,
  createFinalGroupDiscussionEvaluation,
  refreshGroupDiscussionSessionAnalysis,
} from "@/lib/group-discussion/analysis";
import type {
  GroupDiscussionAiTurnOutput,
  GroupDiscussionFinalizeOutput,
  GroupDiscussionParticipant,
  GroupDiscussionSessionRecord,
  GroupDiscussionTopicOutput,
  GroupDiscussionTopicRequest,
  GroupDiscussionUtterance,
} from "@/lib/schemas/groupDiscussion";

export function createMockGroupDiscussionTopic(
  request: GroupDiscussionTopicRequest,
): GroupDiscussionTopicOutput {
  const companyHint = request.companyContext.includes("金融")
    ? "金融サービス"
    : request.companyContext.includes("環境")
      ? "環境保全"
      : "新規サービス";
  return {
    topic: `${companyHint}領域で、若年層に継続利用される新しい体験を提案してください。`,
    category: request.category,
    assumptions: [
      "対象ユーザーは18〜29歳",
      "初期予算は限定的で、3か月で検証する",
      "収益性と社会的価値の両方を評価する",
    ],
    expectedIssues: [
      "誰のどの課題を解くか",
      "利用継続の動機をどう作るか",
      "実現性とリスクをどう判断するか",
    ],
  };
}

export function createDefaultAiParticipants(): GroupDiscussionParticipant[] {
  return [
    {
      id: "ai-facilitator",
      name: "AI 進行役",
      role: "議論の整理",
      stance: "論点と残り時間を明確にする",
      type: "ai",
    },
    {
      id: "ai-analyst",
      name: "AI 分析役",
      role: "比較・検証",
      stance: "前提と評価基準を重視する",
      type: "ai",
    },
  ];
}

function nextAiParticipant(
  session: GroupDiscussionSessionRecord,
): GroupDiscussionParticipant {
  const aiParticipants = session.participants.filter(
    (participant) => participant.type === "ai",
  );
  return (
    aiParticipants[session.utterances.length % Math.max(1, aiParticipants.length)] ??
    createDefaultAiParticipants()[0]
  );
}

export function createMockAiTurn(
  session: GroupDiscussionSessionRecord,
): GroupDiscussionAiTurnOutput {
  const participant = nextAiParticipant(session);
  const previous = session.utterances.at(-1)?.text ?? "";
  const text =
    participant.id === "ai-facilitator"
      ? `今の意見を受けると、まず評価基準を置きたいです。${previous ? "継続利用、実現性、収益性の3点で比較しましょう。" : "誰の課題かを先に決めましょう。"}`
      : `その前提なら、ユーザーの利用頻度を仮説にして検証したいです。メリットだけでなく、運用コストと離脱リスクも見た方がよいと思います。`;
  const now = new Date().toISOString();
  const utterance: GroupDiscussionUtterance = {
    id: `gd-ai-${crypto.randomUUID()}`,
    sessionId: session.id,
    speakerId: participant.id,
    speakerName: participant.name,
    speakerType: "ai",
    text,
    source: "ai",
    startedAt: now,
    endedAt: now,
    durationSeconds: Math.max(4, Math.ceil(text.length / 12)),
    analysis: analyzeGroupDiscussionUtterance({ text }),
  };
  return { utterance };
}

export function createMockFinalEvaluation(
  session: GroupDiscussionSessionRecord,
): GroupDiscussionFinalizeOutput {
  const analyzed = refreshGroupDiscussionSessionAnalysis(session);
  const metrics = analyzed.metrics ?? calculateGroupDiscussionMetrics(analyzed);
  const discussionMap = buildGroupDiscussionMap(analyzed);
  return {
    metrics,
    discussionMap,
    finalEvaluation: createFinalGroupDiscussionEvaluation(
      { ...analyzed, metrics, discussionMap },
      metrics,
    ),
  };
}
