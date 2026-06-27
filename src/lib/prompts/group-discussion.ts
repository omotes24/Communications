import type {
  GroupDiscussionAiTurnRequest,
  GroupDiscussionFinalizeRequest,
  GroupDiscussionTopicRequest,
} from "@/lib/schemas/groupDiscussion";

const safetyNotice = [
  "これはグループディスカッション練習用の機能です。",
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
    `テーマタイプ: ${request.topicType}`,
    `練習モード: ${request.practiceMode}`,
    `練習時間: ${request.durationMinutes}分`,
    `評価重点: ${request.evaluationFocus.join(", ") || "標準"}`,
    request.companyContext ? `企業・職種文脈:\n${request.companyContext}` : "",
    request.profileContext ? `本人情報:\n${request.profileContext}` : "",
    "テーマは実戦的で、賛否・比較・優先順位付け・結論形成ができるものにしてください。",
    "会社文脈がある場合は業界、事業、社風、採用要件に近づけてください。ただし内部情報や最新ニュースを断定しないでください。推測は想定として扱ってください。",
    "出力には title, topic, topic_type, difficulty, assumed_company_or_industry, background, constraints, deliverable, evaluation_focus, suggested_time_allocation, sample_good_direction, common_traps を含めてください。",
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
    "あなたは新卒採用のGD練習に参加するAI学生です。採用担当者ではなく、同じ選考を受ける学生として振る舞ってください。",
    "発言は短く自然にしてください。原則1〜3文です。",
    "毎回完璧な意見を言わず、ユーザーが発言しやすい余白を残してください。",
    "議論を完全に奪わず、論点整理、前提確認、代替案、結論形成のいずれかで貢献してください。",
    "pressureモードでは、沈黙、反論、脱線、発言過多などの負荷を少し入れてください。ただし人格攻撃や差別的発言は禁止です。",
    `テーマ: ${session.topic}`,
    `現在フェーズ: ${request.currentPhase ?? session.currentPhase}`,
    request.remainingSeconds === undefined
      ? ""
      : `残り時間: ${request.remainingSeconds}秒`,
    `練習モード: ${session.practiceMode}`,
    `参加者:\n${session.participants
      .map(
        (participant) =>
          `- ${participant.id} ${participant.name}: ${participant.role} / ${participant.stance} / persona=${participant.persona ?? "none"}`,
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
    "あなたは新卒採用のGD評価者です。ただし合否は断定せず、通過可能性は目安として返してください。",
    "発言量ではなく、議論への実質貢献を評価してください。",
    "必ず発話ログに基づいて採点し、根拠がない評価は避けてください。",
    "スコアは甘くしすぎず、各項目1〜5点で評価してください。",
    "就活生が次に何をすればいいか、具体的なアクションと改善発言例を返してください。",
    "発言ログが少ない場合は「判断材料が不足しています」と明記してください。",
    `テーマ: ${session.topic}`,
    `制限時間: ${session.durationMinutes}分`,
    `最終結論: ${request.finalAnswer ?? session.finalAnswer}`,
    `発表文: ${request.presentationText ?? session.presentationText}`,
    `評価重点: ${session.evaluationFocus.join(", ")}`,
    `会社文脈: ${session.topicDetails.assumedCompanyOrIndustry || "未指定"}`,
    `発話ログ:\n${session.utterances
      .map(
        (utterance) =>
          `${utterance.id} ${utterance.speakerName} ${utterance.speakerType} ${utterance.durationSeconds}s tags=${utterance.analysis?.tags.join(",") ?? ""}: ${utterance.text}`,
      )
      .join("\n")}`,
    "JSONは指定schemaに合わせて返してください。evidence.quote には実際の発話を短く引用してください。",
  ].join("\n\n");
}
