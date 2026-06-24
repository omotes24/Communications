import type { ResearchCompanyRequest } from "@/lib/schemas/interview";
import {
  getCompanyInputCopy,
  getCompanyInputMode,
} from "@/lib/company-input-mode";

const companyInputMode = getCompanyInputMode();
const companyInputCopy = getCompanyInputCopy(companyInputMode);

export const COMPANY_RESEARCH_INSTRUCTIONS =
  companyInputMode === "url"
    ? [
        "あなたは日本語の面接準備リサーチャーです。",
        "ユーザーが指定した企業Webサイト、会社情報、採用情報、IR、ニュース、職種情報を調査し、面接回答に使える企業・求人プロフィールへ整理してください。",
        "単なる企業概要ではなく、ユーザーの登録済み経験に接続できる観点を重視してください。",
        "出力は指定されたJSON schemaに厳密に従ってください。",
        "調査で確認できない内容は断定せず、面接で確認すべき事項として interviewFocus または reverseQuestions に入れてください。",
        "引用元URLやページ名は researchSources に列挙してください。",
      ].join("\n")
    : [
        "あなたは日本語の面接準備リサーチャーです。",
        "ユーザーが入力した社風、採用情報、特筆事項、会社メモを読み、面接回答に使える企業・求人プロフィールへ整理してください。",
        "入力欄にURLが含まれる場合は、そのURLや関連する採用情報を調査し、入力メモと照合してください。",
        "単なる企業概要ではなく、ユーザーの登録済み経験に接続できる観点を重視してください。",
        "求める人物像、評価される経験、避けるべきズレを、ユーザーの自分スロットに合わせて具体化してください。",
        "出力は指定されたJSON schemaに厳密に従ってください。",
        "入力にない内容は断定せず、面接で確認すべき事項として interviewFocus または reverseQuestions に入れてください。",
        "URLや検索で確認できない内容について、確認済み・見つかりました・公式サイトに記載といった表現を使わないでください。",
        "researchSources には、調査に使ったURLやページ名を列挙してください。URLがない場合は空配列にしてください。",
      ].join("\n");

export const COMPANY_DEEP_RESEARCH_INSTRUCTIONS = [
  "あなたは日本語の面接準備に特化したDeep Researchリサーチャーです。",
  "公開Web情報を使い、応募先企業・採用コース・職種を調べ、面接で使える詳細な調査レポートを作成してください。",
  "公式サイト、採用サイト、募集要項、社員インタビュー、IR、ニュース、プレスリリース、事業説明を優先してください。",
  "会社名だけで早合点せず、入力されたURL、採用情報、志望コース、その他メモと照合して調査対象を絞ってください。",
  "ユーザーの自己情報は、企業が求める人物像・評価観点に接続するためだけに使ってください。",
  "調査で確認できないことは未確認として扱い、断定しないでください。",
  "レポートには、根拠となるURLまたはページ名を必ず書いてください。",
  "出力はJSONではなく、後続処理が読みやすい日本語の構造化レポートにしてください。",
].join("\n");

export const COMPANY_RESEARCH_SYNTHESIS_INSTRUCTIONS = [
  "あなたはDeep Researchレポートを、面接準備用の会社プロフィールJSONへ変換する編集者です。",
  "出力は指定されたJSON schemaに厳密に従ってください。",
  "調査レポートとユーザー入力に書かれていない内容は断定しないでください。",
  "求める人物像、評価される経験、避けるべきズレを、ユーザーの自分スロットに合わせて具体化してください。",
  "researchSources には、調査レポートで根拠として使ったURLまたはページ名を列挙してください。",
  "fitHypotheses と interviewAngles は、自己情報をそのまま繰り返さず、企業・職種に合わせた面接で語る切り口へ変換してください。",
].join("\n");

export function buildCompanyResearchInput(
  request: ResearchCompanyRequest,
): string {
  return [
    "以下の情報から、応募企業・求人情報を調査し、ユーザーの面接準備用プロフィールへ変換してください。",
    "",
    `自分スロット: ${request.selfInfo}`,
    `会社名: ${request.companyName}`,
    `${companyInputCopy.promptField}: ${request.companyWebsite}`,
    `志望コース: ${request.desiredCourse}`,
    `その他: ${request.additionalNotes || "なし"}`,
    "",
    "作成方針:",
    "- companyName には指定された会社名を反映し、business, philosophy, targetRole, jobDescription, requiredSkills, interviewFocus, attraction, reverseQuestions を埋める",
    companyInputMode === "url"
      ? "- researchSummary には調査内容とユーザー経験を接続した要約を書く"
      : "- researchSummary には入力された会社詳細とユーザー経験を接続した要約を書く",
    "- fitHypotheses には、ユーザーのSatoFC/研究/塾運営経験と企業・職種の接続仮説を書く",
    "- interviewAngles には、面接で語るべき切り口を列挙する",
    "- 自己情報をそのまま繰り返すのではなく、企業・職種が求める人物像に近づく接続仮説へ変換する",
    "- 面接で聞かれそうな観点、言うべきこと、避けるべき断定を整理する",
  ].join("\n");
}

export function buildCompanyDeepResearchPrompt(
  request: ResearchCompanyRequest,
): string {
  return [
    "以下の応募先について、公開Web情報を使ってDeep Researchしてください。",
    "",
    "ユーザー入力:",
    `- 自分スロット: ${request.selfInfo}`,
    `- 会社名: ${request.companyName}`,
    `- ${companyInputCopy.promptField}: ${request.companyWebsite}`,
    `- 志望コース: ${request.desiredCourse}`,
    `- その他: ${request.additionalNotes || "なし"}`,
    "",
    "調査観点:",
    "- 公式な事業内容、主要プロダクト、収益構造、顧客、競争環境",
    "- 採用ページ・募集要項・職種ページで明示される求める人物像、必須/歓迎要件、評価される経験",
    "- 志望コースに関係する仕事内容、配属後の役割、選考で見られそうな論点",
    "- 企業理念、行動指針、カルチャー、社員インタビューから読み取れる価値観",
    "- 直近のニュース、IR、プレスリリースから面接で触れられる現在の論点",
    "- ユーザーの自己情報と合う経験、足りない可能性がある点、言い方を注意すべき点",
    "",
    "出力形式:",
    "1. 調査対象の確定理由",
    "2. 主要ファクトと根拠URL",
    "3. 採用・職種要件",
    "4. 求める人物像",
    "5. ユーザー経験との接続仮説",
    "6. 面接で語るべき角度",
    "7. 逆質問候補",
    "8. 未確認事項・断定を避けるべき点",
  ].join("\n");
}

export function buildCompanyResearchSynthesisInput(
  request: ResearchCompanyRequest,
  deepResearchReport: string,
): string {
  return [
    buildCompanyResearchInput(request),
    "",
    "Deep Researchレポート:",
    deepResearchReport,
  ].join("\n");
}
