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
        "ユーザーが指定した企業Webサイト、会社情報、採用情報、IR、ニュース、職種情報をDeep Researchし、面接回答に使える企業・求人プロフィールへ整理してください。",
        "単なる企業概要ではなく、ユーザーの登録済み経験に接続できる観点を重視してください。",
        "出力は指定されたJSON schemaに厳密に従ってください。",
        "調査で確認できない内容は断定せず、面接で確認すべき事項として interviewFocus または reverseQuestions に入れてください。",
        "引用元URLやページ名は researchSources に列挙してください。",
      ].join("\n")
    : [
        "あなたは日本語の面接準備リサーチャーです。",
        "ユーザーが入力した社風、採用情報、特筆事項、会社メモを読み、面接回答に使える企業・求人プロフィールへ整理してください。",
        "単なる企業概要ではなく、ユーザーの登録済み経験に接続できる観点を重視してください。",
        "出力は指定されたJSON schemaに厳密に従ってください。",
        "入力にない内容は断定せず、面接で確認すべき事項として interviewFocus または reverseQuestions に入れてください。",
        "入力欄に書かれていない内容について、確認済み・見つかりました・公式サイトに記載といった表現を使わないでください。",
        "researchSources には、入力欄にURLが含まれている場合のみURLを列挙してください。URLがない場合は空配列にしてください。",
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
    "- 自己情報をそのまま繰り返すのではなく、企業・職種との接続仮説に変換する",
    "- 面接で聞かれそうな観点、言うべきこと、避けるべき断定を整理する",
  ].join("\n");
}
