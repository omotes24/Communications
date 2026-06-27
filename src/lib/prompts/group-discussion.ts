import type {
  GroupDiscussionAiTurnRequest,
  GroupDiscussionFinalizeRequest,
  GroupDiscussionTopicRequest,
} from "@/lib/schemas/groupDiscussion";

const safetyNotice = [
  "これはグループディスカッション練習用の機能です。",
  "実選考での無断録音、隠れた支援、第三者の同意なしの利用を助長しないでください。",
  "評価は発話ログに基づき、根拠発話IDがない断定は避けてください。",
].join("\n");

export function buildGroupDiscussionTopicPrompt(
  request: GroupDiscussionTopicRequest,
): string {
  return [
    safetyNotice,
    "日本語で、就活・転職のグループディスカッション練習テーマを1つ作ってください。",
    `カテゴリ: ${request.category}`,
    `難易度: ${request.difficulty}`,
    request.companyContext ? `企業・職種文脈:\n${request.companyContext}` : "",
    request.profileContext ? `本人情報:\n${request.profileContext}` : "",
    "テーマは実戦的で、賛否・比較・優先順位付けができるものにしてください。",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildGroupDiscussionAiTurnPrompt(
  request: GroupDiscussionAiTurnRequest,
): string {
  const session = request.session;
  return [
    safetyNotice,
    "あなたはGD練習のAI参加者です。短く自然に発言してください。",
    "ユーザーの発言機会を奪わず、1発言は80〜140字程度にしてください。",
    "攻撃的にならず、論点整理、前提確認、代替案、結論形成のいずれかで貢献してください。",
    `テーマ: ${session.topic}`,
    `参加者:\n${session.participants
      .map(
        (participant) =>
          `- ${participant.name}: ${participant.role} / ${participant.stance}`,
      )
      .join("\n")}`,
    `直近発話:\n${session.utterances
      .slice(-8)
      .map(
        (utterance) =>
          `${utterance.id} ${utterance.speakerName}: ${utterance.text}`,
      )
      .join("\n")}`,
  ].join("\n\n");
}

export function buildGroupDiscussionFinalPrompt(
  request: GroupDiscussionFinalizeRequest,
): string {
  const session = request.session;
  return [
    safetyNotice,
    "以下のGD練習ログを評価してください。",
    "必ず発話IDを根拠として使い、根拠がない項目は低めに評価してください。",
    "評価項目: 発言時間、発言回数、質問回数、他者発言への接続、議論前進/後退、論点整理、遮り候補、結論形成貢献、時間管理。",
    `テーマ: ${session.topic}`,
    `制限時間: ${session.durationMinutes}分`,
    `発話ログ:\n${session.utterances
      .map(
        (utterance) =>
          `${utterance.id} ${utterance.speakerName} ${utterance.durationSeconds}s: ${utterance.text}`,
      )
      .join("\n")}`,
  ].join("\n\n");
}
