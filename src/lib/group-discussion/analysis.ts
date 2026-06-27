import type {
  GroupDiscussionFinalEvaluation,
  GroupDiscussionMap,
  GroupDiscussionMetrics,
  GroupDiscussionSessionRecord,
  GroupDiscussionUtterance,
  GroupDiscussionUtteranceAnalysis,
} from "@/lib/schemas/groupDiscussion";

const questionCues = [
  "ですか",
  "ますか",
  "ませんか",
  "でしょうか",
  "どう",
  "なぜ",
  "何",
  "教えて",
  "意見",
  "?",
  "？",
];

const connectionCues = [
  "今の",
  "先ほど",
  "それに関連して",
  "一方で",
  "加えて",
  "つまり",
  "たしかに",
  "同意",
  "補足",
];

const progressCues = [
  "結論",
  "整理",
  "比較",
  "優先",
  "基準",
  "次に",
  "具体",
  "仮説",
  "検証",
  "リスク",
];

const regressCues = ["わからない", "なんとなく", "とりあえず", "話を戻すと"];
const issueCues = ["論点", "課題", "基準", "前提", "分け", "整理", "観点"];
const interruptionCues = ["いや", "違う", "でも", "だから"];
const conclusionCues = ["結論", "まとめ", "合意", "決め", "提案", "着地"];
const timeCues = ["時間", "残り", "分", "次", "最後"];

function includesAny(text: string, cues: string[]): boolean {
  return cues.some((cue) => text.includes(cue));
}

function firstEvidence(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  return [trimmed.slice(0, 80)];
}

export function analyzeGroupDiscussionUtterance(
  utterance: Pick<GroupDiscussionUtterance, "text">,
): GroupDiscussionUtteranceAnalysis {
  const text = utterance.text;
  const isQuestion = includesAny(text, questionCues);
  const connectsToPrevious = includesAny(text, connectionCues);
  const issueOrganization = includesAny(text, issueCues);
  const interruptionRisk =
    includesAny(text, interruptionCues) && !connectsToPrevious;
  const conclusionContribution = includesAny(text, conclusionCues);
  const timeManagement = includesAny(text, timeCues);
  const progress =
    includesAny(text, regressCues) && !includesAny(text, progressCues)
      ? "regress"
      : includesAny(text, progressCues) ||
          connectsToPrevious ||
          conclusionContribution
        ? "advance"
        : "neutral";

  return {
    summary: text.slice(0, 72),
    isQuestion,
    connectsToPrevious,
    progress,
    issueOrganization,
    interruptionRisk,
    conclusionContribution,
    timeManagement,
    evidence: firstEvidence(text),
  };
}

function userUtterances(
  session: GroupDiscussionSessionRecord,
): GroupDiscussionUtterance[] {
  return session.utterances.filter((item) => item.speakerType === "user");
}

function evidenceIds(
  utterances: GroupDiscussionUtterance[],
  predicate: (utterance: GroupDiscussionUtterance) => boolean,
): string[] {
  return utterances.filter(predicate).map((utterance) => utterance.id);
}

function metric({
  value,
  target,
  label,
  evidenceUtteranceIds,
  comment,
  inverse = false,
}: {
  value: number;
  target: number;
  label: string;
  evidenceUtteranceIds: string[];
  comment: string;
  inverse?: boolean;
}) {
  const rawScore = target <= 0 ? 0 : Math.round((value / target) * 100);
  const score = inverse
    ? Math.max(0, Math.min(100, 100 - rawScore))
    : Math.max(0, Math.min(100, rawScore));
  return {
    score,
    value,
    label,
    evidenceUtteranceIds,
    comment,
  };
}

export function calculateGroupDiscussionMetrics(
  session: GroupDiscussionSessionRecord,
): GroupDiscussionMetrics {
  const users = userUtterances(session);
  const analyzed = users.map((utterance) => ({
    ...utterance,
    analysis:
      utterance.analysis ?? analyzeGroupDiscussionUtterance(utterance),
  }));
  const durationSeconds = Math.max(60, session.durationMinutes * 60);
  const speakingSeconds = analyzed.reduce(
    (sum, utterance) => sum + utterance.durationSeconds,
    0,
  );
  const expectedSpeakingSeconds =
    session.mode === "ai-participants"
      ? Math.round(durationSeconds / 3)
      : Math.round(durationSeconds / 2);

  return {
    speakingTimeSeconds: metric({
      value: speakingSeconds,
      target: expectedSpeakingSeconds,
      label: "発言時間",
      evidenceUtteranceIds: analyzed.map((utterance) => utterance.id),
      comment:
        speakingSeconds > 0
          ? "発言量は計測できています。長く話すより、論点ごとに短く切ると評価が安定します。"
          : "まだ発言がありません。",
    }),
    utteranceCount: metric({
      value: analyzed.length,
      target: session.mode === "ai-participants" ? 6 : 4,
      label: "発言回数",
      evidenceUtteranceIds: analyzed.map((utterance) => utterance.id),
      comment: "沈黙せず、短い発言を複数回入れるほど議論に参加していることが伝わります。",
    }),
    questionCount: metric({
      value: analyzed.filter((utterance) => utterance.analysis.isQuestion)
        .length,
      target: 2,
      label: "質問回数",
      evidenceUtteranceIds: evidenceIds(
        analyzed,
        (utterance) => utterance.analysis?.isQuestion ?? false,
      ),
      comment: "相手の前提や不足情報を確認する質問は、議論の質を上げます。",
    }),
    connectionToOthers: metric({
      value: analyzed.filter(
        (utterance) => utterance.analysis.connectsToPrevious,
      ).length,
      target: 3,
      label: "他者発言への接続",
      evidenceUtteranceIds: evidenceIds(
        analyzed,
        (utterance) => utterance.analysis?.connectsToPrevious ?? false,
      ),
      comment: "直前の発言を受けてから自分の意見を足すと、独り言になりにくくなります。",
    }),
    discussionProgress: metric({
      value: analyzed.filter((utterance) => utterance.analysis.progress === "advance")
        .length,
      target: 4,
      label: "議論の前進",
      evidenceUtteranceIds: evidenceIds(
        analyzed,
        (utterance) => utterance.analysis?.progress === "advance",
      ),
      comment: "比較、基準、結論、次の論点を出す発言は議論を前に進めます。",
    }),
    issueOrganization: metric({
      value: analyzed.filter((utterance) => utterance.analysis.issueOrganization)
        .length,
      target: 2,
      label: "論点整理",
      evidenceUtteranceIds: evidenceIds(
        analyzed,
        (utterance) => utterance.analysis?.issueOrganization ?? false,
      ),
      comment: "前提、評価基準、課題を言語化できると議論全体の見通しが良くなります。",
    }),
    interruptionRisk: metric({
      value: analyzed.filter((utterance) => utterance.analysis.interruptionRisk)
        .length,
      target: 3,
      label: "遮り候補",
      evidenceUtteranceIds: evidenceIds(
        analyzed,
        (utterance) => utterance.analysis?.interruptionRisk ?? false,
      ),
      comment: "遮り候補は少ないほどよいです。否定から入る場合は一度受け止める表現を挟んでください。",
      inverse: true,
    }),
    conclusionContribution: metric({
      value: analyzed.filter(
        (utterance) => utterance.analysis.conclusionContribution,
      ).length,
      target: 2,
      label: "結論形成",
      evidenceUtteranceIds: evidenceIds(
        analyzed,
        (utterance) => utterance.analysis?.conclusionContribution ?? false,
      ),
      comment: "合意点や提案を明文化する発言は、終盤の評価につながります。",
    }),
    timeManagement: metric({
      value: analyzed.filter((utterance) => utterance.analysis.timeManagement)
        .length,
      target: 1,
      label: "時間管理",
      evidenceUtteranceIds: evidenceIds(
        analyzed,
        (utterance) => utterance.analysis?.timeManagement ?? false,
      ),
      comment: "残り時間や次に扱う論点を示すと、進行役でなくても貢献できます。",
    }),
  };
}

export function buildGroupDiscussionMap(
  session: GroupDiscussionSessionRecord,
): GroupDiscussionMap {
  const userItems = userUtterances(session);
  const nodes: GroupDiscussionMap["nodes"] = [
    {
      id: "topic",
      type: "topic" as const,
      label: session.topic,
      evidenceUtteranceIds: [],
    },
  ];
  const edges: GroupDiscussionMap["edges"] = [];

  for (const utterance of userItems.slice(-8)) {
    const analysis =
      utterance.analysis ?? analyzeGroupDiscussionUtterance(utterance);
    const type =
      analysis.conclusionContribution
        ? "conclusion"
        : analysis.issueOrganization
          ? "issue"
          : analysis.isQuestion
            ? "unresolved"
            : analysis.progress === "advance"
              ? "idea"
              : "evidence";
    nodes.push({
      id: `node-${utterance.id}`,
      type,
      label: utterance.text.slice(0, 60),
      evidenceUtteranceIds: [utterance.id],
    });
    edges.push({
      id: `edge-${utterance.id}`,
      from: "topic",
      to: `node-${utterance.id}`,
      label: analysis.connectsToPrevious ? "接続" : "追加",
    });
  }

  return { nodes, edges };
}

export function createFinalGroupDiscussionEvaluation(
  session: GroupDiscussionSessionRecord,
  metrics: GroupDiscussionMetrics,
): GroupDiscussionFinalEvaluation {
  const allMetricScores = Object.values(metrics).map((item) => item.score);
  const totalScore = Math.round(
    allMetricScores.reduce((sum, score) => sum + score, 0) /
      Math.max(1, allMetricScores.length),
  );
  const firstEvidence =
    userUtterances(session)[0]?.id ?? session.utterances[0]?.id ?? "";
  const fallbackEvidence = firstEvidence ? [firstEvidence] : [];
  const connectionEvidence =
    metrics.connectionToOthers.evidenceUtteranceIds.length > 0
      ? metrics.connectionToOthers.evidenceUtteranceIds
      : fallbackEvidence;
  const issueEvidence =
    metrics.issueOrganization.evidenceUtteranceIds.length > 0
      ? metrics.issueOrganization.evidenceUtteranceIds
      : fallbackEvidence;
  const conclusionEvidence =
    metrics.conclusionContribution.evidenceUtteranceIds.length > 0
      ? metrics.conclusionContribution.evidenceUtteranceIds
      : fallbackEvidence;

  return {
    totalScore,
    summary:
      totalScore >= 70
        ? "議論への参加量と論点整理は十分です。次は他者の発言を受けた合意形成を増やすと、より実戦的になります。"
        : "発言は記録できていますが、評価に使える根拠発話がまだ少なめです。短くてもよいので、前提確認、論点整理、結論提案を意識してください。",
    strengths: [
      {
        title: "発言を議論に残せている",
        detail: metrics.utteranceCount.comment,
        evidenceUtteranceIds:
          metrics.utteranceCount.evidenceUtteranceIds.length > 0
            ? metrics.utteranceCount.evidenceUtteranceIds.slice(0, 3)
            : fallbackEvidence,
      },
      {
        title: "論点化できる余地がある",
        detail: metrics.issueOrganization.comment,
        evidenceUtteranceIds: issueEvidence.slice(0, 3),
      },
    ].filter((item) => item.evidenceUtteranceIds.length > 0),
    improvements: [
      {
        title: "他者発言への接続を増やす",
        detail: metrics.connectionToOthers.comment,
        nextAction:
          "次回は「今の意見に加えて」「その前提なら」のように、受けてから足す表現を最低3回入れてください。",
        evidenceUtteranceIds: connectionEvidence.slice(0, 3),
      },
      {
        title: "終盤で結論を置く",
        detail: metrics.conclusionContribution.comment,
        nextAction:
          "残り時間が見えたら、選択肢、判断基準、結論の順で30秒以内にまとめてください。",
        evidenceUtteranceIds: conclusionEvidence.slice(0, 3),
      },
    ].filter((item) => item.evidenceUtteranceIds.length > 0),
    nextPractice: [
      "冒頭2分で前提と評価基準を置く",
      "他者発言を1回受けてから自分の提案を出す",
      "終了2分前に結論案を言語化する",
    ],
  };
}

export function refreshGroupDiscussionSessionAnalysis(
  session: GroupDiscussionSessionRecord,
): GroupDiscussionSessionRecord {
  const utterances = session.utterances.map((utterance) => ({
    ...utterance,
    analysis:
      utterance.analysis ?? analyzeGroupDiscussionUtterance(utterance),
  }));
  const analyzedSession = { ...session, utterances };
  const metrics = calculateGroupDiscussionMetrics(analyzedSession);
  return {
    ...analyzedSession,
    discussionMap: buildGroupDiscussionMap(analyzedSession),
    metrics,
    updatedAt: new Date().toISOString(),
  };
}
