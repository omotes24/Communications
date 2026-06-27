import {
  analyzeGroupDiscussionUtterance,
  buildGroupDiscussionMap,
  calculateGroupDiscussionMetrics,
  createFinalGroupDiscussionEvaluation,
  refreshGroupDiscussionSessionAnalysis,
} from "@/lib/group-discussion/analysis";
import type {
  GDPersona,
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
    title: `${companyHint}の優先施策を決める`,
    topic: `${companyHint}領域で、若年層に継続利用される新しい体験を提案してください。`,
    topic_type: request.topicType,
    difficulty: request.difficulty,
    assumed_company_or_industry: companyHint,
    background:
      "限られた予算と短い検証期間の中で、利用者価値と実現性の両方を満たす施策を選ぶ必要があります。",
    constraints: [
      "初期予算は限定的",
      "3か月以内に効果検証できること",
      "既存顧客への悪影響を避けること",
    ],
    deliverable:
      "最初に実行すべき施策、選定理由、検証方法、想定リスクをまとめる",
    evaluation_focus: request.evaluationFocus.length
      ? request.evaluationFocus
      : ["論点整理", "意思決定", "実現性"],
    suggested_time_allocation: [
      "前提確認 2分",
      "案出し 5分",
      "比較 6分",
      "結論 3分",
    ],
    sample_good_direction:
      "対象者、課題、評価基準を先に置き、複数案を効果・実現性・リスクで比較する。",
    common_traps: [
      "施策をたくさん出して決めきれない",
      "若年層を一括りにしてしまう",
      "検証方法が曖昧なまま終わる",
    ],
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

const personaProfiles: Record<
  GDPersona,
  Omit<GroupDiscussionParticipant, "id" | "type" | "persona">
> = {
  balanced: {
    name: "AI 標準",
    role: "参加者",
    stance: "議論全体のバランスを見る",
  },
  quiet: {
    name: "AI 寡黙",
    role: "控えめな参加者",
    stance: "促されると短く意見を出す",
  },
  dominant: {
    name: "AI 多弁",
    role: "話しすぎる参加者",
    stance: "自分の案を強く押しやすい",
  },
  logical: {
    name: "AI 論理派",
    role: "比較・検証",
    stance: "前提と評価基準を重視する",
  },
  off_topic: {
    name: "AI 脱線気味",
    role: "論点がずれやすい参加者",
    stance: "関連するが少し広い話を出す",
  },
  agreeable: {
    name: "AI 同意派",
    role: "協調的な参加者",
    stance: "同意しながら補足する",
  },
  skeptical: {
    name: "AI 反論派",
    role: "懸念を出す参加者",
    stance: "リスクと抜け漏れを指摘する",
  },
  time_keeper: {
    name: "AI 時間管理",
    role: "時間を気にする参加者",
    stance: "残り時間から結論形成を促す",
  },
};

export function createDefaultAiParticipants(
  personas: GDPersona[] = ["balanced", "logical"],
  count = 2,
): GroupDiscussionParticipant[] {
  return personas.slice(0, Math.max(0, Math.min(5, count))).map((persona, index) => {
    const profile = personaProfiles[persona] ?? personaProfiles.balanced;
    return {
      id: `ai-${persona}-${index + 1}`,
      name: profile.name,
      role: profile.role,
      stance: profile.stance,
      persona,
      type: "ai",
    };
  });
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
  const text = createPersonaUtterance(participant.persona ?? "balanced", {
    previous,
    phase: session.currentPhase,
    pressure: session.practiceMode === "pressure",
  });
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

function createPersonaUtterance(
  persona: GDPersona,
  context: { previous: string; phase: string; pressure: boolean },
): string {
  if (context.phase === "converge" || context.phase === "present") {
    return "そろそろ結論を一つに絞りたいです。評価基準に照らすと、最初に検証しやすい案を選ぶのがよさそうです。";
  }
  if (persona === "quiet") {
    return "私は、まず対象者をもう少し絞るのがよいと思います。そこが決まると案を比べやすいです。";
  }
  if (persona === "dominant") {
    return context.pressure
      ? "私はキャンペーン案で決めてよいと思います。細かい比較より、早く動ける案を選びたいです。"
      : "施策としてはキャンペーン案が一番わかりやすいと思います。実行までの速さもあります。";
  }
  if (persona === "logical") {
    return "比較基準を、効果・実現性・リスクの3つに分けませんか。その方が結論を決めやすいです。";
  }
  if (persona === "off_topic") {
    return context.pressure
      ? "少しずれますが、SNSで話題になるかも大事だと思います。話題性から考えてもよいですか。"
      : "関連して、認知をどう広げるかも少し見たいです。";
  }
  if (persona === "agreeable") {
    return `今の意見には賛成です。${context.previous ? "そのうえで、検証方法まで置けるとさらに良いと思います。" : "まず課題を絞りたいです。"}`;
  }
  if (persona === "skeptical") {
    return "その案は良いですが、運用コストと失敗時の影響も見たいです。リスクを一つ置いて比較しましょう。";
  }
  if (persona === "time_keeper") {
    return "残り時間を考えると、次に案を2つまで絞って、最後に理由をまとめたいです。";
  }
  return "今の意見を受けると、まず評価基準を置きたいです。効果、実現性、リスクの3点で比較しましょう。";
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
