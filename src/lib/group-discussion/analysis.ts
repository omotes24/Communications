import type {
  GDEvaluationScore,
  GDPhase,
  GDSpeechTag,
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

const definitionCues = ["定義", "つまり", "ここでは", "意味", "捉えます"];
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
const reasonCues = ["理由", "なぜなら", "背景", "根拠", "ためです"];
const summaryCues = ["要約", "整理すると", "まとめると", "ここまで"];
const inclusionCues = ["どう思いますか", "意見ありますか", "さんは", "聞きたい"];
const riskCues = ["リスク", "懸念", "課題", "難しい", "失敗"];
const exampleCues = ["例えば", "具体", "ケース", "事例"];
const vagueCues = ["いい感じ", "なんか", "多分", "いろいろ", "すごく"];
const repetitionCues = ["同じ", "繰り返し", "先ほどと同様"];

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

export function classifyGroupDiscussionSpeechTags(text: string): GDSpeechTag[] {
  const tags = new Set<GDSpeechTag>();
  if (includesAny(text, ["前提", "条件", "対象", "予算", "期限"])) {
    tags.add("premise_setting");
  }
  if (includesAny(text, definitionCues)) {
    tags.add("definition");
  }
  if (includesAny(text, ["思います", "考えます", "案", "施策", "提案"])) {
    tags.add("opinion");
  }
  if (includesAny(text, reasonCues)) {
    tags.add("reason");
  }
  if (includesAny(text, questionCues)) {
    tags.add("question");
  }
  if (includesAny(text, summaryCues)) {
    tags.add("summary");
  }
  if (includesAny(text, ["進め", "まず", "次に", "役割", "確認"])) {
    tags.add("facilitation");
  }
  if (includesAny(text, inclusionCues)) {
    tags.add("inclusion");
  }
  if (includesAny(text, interruptionCues)) {
    tags.add("disagreement");
  }
  if (includesAny(text, ["同意", "たしかに", "賛成", "その通り"])) {
    tags.add("agreement");
  }
  if (includesAny(text, ["決め", "選び", "優先", "結論", "採用"])) {
    tags.add("decision");
  }
  if (includesAny(text, riskCues)) {
    tags.add("risk");
  }
  if (includesAny(text, exampleCues)) {
    tags.add("example");
  }
  if (includesAny(text, ["関係ない", "別の話", "脱線"])) {
    tags.add("off_topic");
  }
  if (includesAny(text, vagueCues)) {
    tags.add("vague");
  }
  if (includesAny(text, repetitionCues)) {
    tags.add("repetition");
  }
  if (includesAny(text, timeCues)) {
    tags.add("time_management");
  }
  if (includesAny(text, conclusionCues)) {
    tags.add("closing");
  }
  if (tags.size === 0) {
    tags.add("opinion");
  }
  return Array.from(tags);
}

export function analyzeGroupDiscussionUtterance(
  utterance: Pick<GroupDiscussionUtterance, "text">,
): GroupDiscussionUtteranceAnalysis {
  const text = utterance.text;
  const tags = classifyGroupDiscussionSpeechTags(text);
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
    tags,
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
  const users = userUtterances(session).map((utterance) => ({
    ...utterance,
    analysis:
      utterance.analysis ?? analyzeGroupDiscussionUtterance(utterance),
  }));
  const allMetricScores = Object.values(metrics).map((item) => item.score);
  const metricAverage =
    allMetricScores.reduce((sum, score) => sum + score, 0) /
    Math.max(1, allMetricScores.length);
  const tagCount = (tag: GDSpeechTag) =>
    users.filter((utterance) => utterance.analysis.tags.includes(tag)).length;
  const scale = (value: number, target: number) =>
    Math.max(1, Math.min(5, Math.round((value / target) * 4) + 1));
  const scoreFromMetric = (score: number) =>
    Math.max(1, Math.min(5, Math.round(score / 25) + 1));
  const scores: GDEvaluationScore = {
    issue_definition: Math.max(
      scale(tagCount("premise_setting") + tagCount("definition"), 2),
      scoreFromMetric(metrics.issueOrganization.score),
    ),
    logical_thinking: Math.max(
      scale(tagCount("reason") + tagCount("risk") + tagCount("example"), 3),
      scoreFromMetric(metrics.discussionProgress.score),
    ),
    contribution: scoreFromMetric(metrics.discussionProgress.score),
    collaboration: Math.max(
      scale(tagCount("inclusion") + tagCount("agreement"), 2),
      scoreFromMetric(metrics.connectionToOthers.score),
    ),
    listening_summary: scale(tagCount("summary") + tagCount("question"), 2),
    decision_making: Math.max(
      scale(tagCount("decision") + tagCount("closing"), 2),
      scoreFromMetric(metrics.conclusionContribution.score),
    ),
    time_management: scoreFromMetric(metrics.timeManagement.score),
    output_quality: Math.max(
      1,
      Math.min(
        5,
        Math.round(
          (scoreFromMetric(metrics.conclusionContribution.score) +
            scoreFromMetric(metrics.issueOrganization.score)) /
            2,
        ),
      ),
    ),
    presentation: session.presentationText.trim().length > 80 ? 4 : 2,
    company_fit:
      session.companySlotIds.length > 0 || session.topicDetails.assumedCompanyOrIndustry
        ? 3
        : 2,
  };
  const scoreValues = Object.values(scores).filter(
    (score): score is number => typeof score === "number",
  );
  const totalScore = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        (scoreValues.reduce((sum, score) => sum + score, 0) /
          Math.max(1, scoreValues.length)) *
          20 *
          0.75 +
          metricAverage * 0.25,
      ),
    ),
  );
  const passPossibility =
    totalScore >= 78 ? "high" : totalScore >= 58 ? "medium" : "low";
  const firstUser = users[0];
  const bestIssue = users.find((utterance) =>
    utterance.analysis.tags.some((tag) =>
      ["premise_setting", "definition", "summary", "decision"].includes(tag),
    ),
  );
  const weakUtterance = users.find((utterance) =>
    utterance.analysis.tags.some((tag) =>
      ["vague", "off_topic", "repetition"].includes(tag),
    ),
  );
  const evidenceQuote = (utterance: GroupDiscussionUtterance | undefined) =>
    utterance?.text.slice(0, 120) ??
    "発言ログが少ないため、引用できる発話が不足しています。";
  const insufficient = users.length < 2;

  return {
    totalScore,
    passPossibility,
    scores,
    summary: insufficient
      ? "判断材料が不足しています。今回は発言ログが少ないため、通過可能性は目安として低めに置いています。次回は前提確認、論点整理、結論案を最低1回ずつ入れてください。"
      : totalScore >= 70
        ? "論点整理や結論形成に評価できる発話があります。次は他者の発言を要約してから意思決定に進めると、より本番で伝わりやすくなります。"
        : "発言は残せていますが、評価に直結する前提確認・要約・意思決定の発話がまだ不足しています。発言量より、議論を前に進める短い発言を増やしてください。",
    strengths: [
      "議論に参加する発話を残せている",
      scores.issue_definition >= 3
        ? "前提や評価基準を置く意識がある"
        : "改善余地はあるが、論点整理に取り組める土台がある",
      scores.decision_making >= 3
        ? "結論形成に向かう発言がある"
        : "結論形成を意識すると伸びやすい",
    ].slice(0, 3),
    weaknesses: [
      scores.listening_summary <= 2
        ? "他者発言の要約や確認質問が少ない"
        : "要約はできているため、意思決定への接続を増やしたい",
      scores.time_management <= 2
        ? "残り時間から逆算する発言が不足している"
        : "時間意識はあるため、終盤の結論案をさらに明確にしたい",
      scores.output_quality <= 2
        ? "結論の具体性・実行可能性がまだ弱い"
        : "結論は出せているため、根拠とリスクを添えると安定する",
    ].slice(0, 3),
    nextActions: [
      "冒頭2分で「前提・評価基準・ゴール」を一文で置く",
      "中盤で一度「ここまでを整理すると」と要約してから比較に入る",
      "終盤2分前に「結論案・理由・懸念」をセットで出す",
    ],
    evidence: [
      {
        quote: evidenceQuote(bestIssue ?? firstUser),
        comment:
          "論点整理・前提確認・結論形成につながる発話として評価しました。",
        relatedScoreKey: "issue_definition",
      },
      {
        quote: evidenceQuote(weakUtterance ?? firstUser),
        comment:
          weakUtterance
            ? "抽象度や論点ずれの可能性があるため、より具体化すると評価が上がります。"
            : "改善引用に使える発話が少ないため、次回は比較・要約・結論の発話を増やしてください。",
        relatedScoreKey: "output_quality",
      },
    ],
    goodQuotes: [evidenceQuote(bestIssue ?? firstUser)],
    improvementQuotes: [evidenceQuote(weakUtterance ?? firstUser)],
    improvedPhrases: [
      {
        original: evidenceQuote(weakUtterance ?? firstUser),
        improved:
          "ここでは評価基準を、実現性・効果・リスクの3つに分けて比較したいです。そのうえで、最初に実現性の高い案から検討しましょう。",
        reason:
          "抽象的な意見を、評価基準と次の進め方まで含む発言に変えるためです。",
      },
    ],
    recommendedDrills: recommendGroupDiscussionDrills(scores),
    improvedPresentation: buildImprovedPresentation(session),
    nextPractice: [
      "90秒で論点を3つに分ける",
      "2分で結論を作る",
      "沈黙している参加者を巻き込む",
    ],
  };
}

export function recommendGroupDiscussionDrills(
  scores: GDEvaluationScore,
): string[] {
  const drills: string[] = [];
  if (scores.issue_definition <= 2) {
    drills.push("90秒で論点を3つに分ける");
  }
  if (scores.decision_making <= 2 || scores.output_quality <= 2) {
    drills.push("2分で結論を作る");
  }
  if (scores.collaboration <= 2 || scores.listening_summary <= 2) {
    drills.push("沈黙している参加者を巻き込む");
  }
  if (scores.presentation <= 2) {
    drills.push("最終発表を2分で行う");
  }
  if (drills.length === 0) {
    drills.push("反論された意見を立て直す");
  }
  return drills.slice(0, 3);
}

function buildImprovedPresentation(session: GroupDiscussionSessionRecord): string {
  const deliverable =
    session.topicDetails.deliverable || "実行しやすい結論を提案すること";
  const finalAnswer = session.finalAnswer.trim();
  if (finalAnswer.length > 40) {
    return `結論として、${finalAnswer.replace(/^結論として、?/, "")}。理由は、今回のテーマ「${session.topic}」では、効果だけでなく実現性とリスクを同時に見なければならないからです。まず短期で検証し、結果を見て次の施策に広げる進め方がよいと考えます。`;
  }
  return `結論として、今回のテーマでは「${deliverable}」を重視し、実現性・効果・リスクの3点で案を比較するのがよいと考えます。短期で検証できる施策を先に実行し、その結果をもとに次の打ち手を決める形にすると、議論の結論として具体性が出ます。`;
}

export const gdPhaseLabels: Record<GDPhase, string> = {
  intro: "前提確認・役割決め",
  define: "定義・ゴール確認",
  diverge: "アイデア出し",
  analyze: "比較・深掘り",
  converge: "意思決定・結論形成",
  present: "最終発表",
  review: "採点・振り返り",
};

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
