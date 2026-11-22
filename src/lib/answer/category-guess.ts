import type { QuestionCategory } from "@/lib/schemas/interview";

// 質問判定 API の結果を待たずに回答生成を始めるときの、暫定カテゴリ。
// 判定結果は後から届き、表示と重複検知に使う。回答プロンプトへの影響は「分類:」の1行だけ。
const categoryRules: Array<[QuestionCategory, RegExp]> = [
  [
    "introduction",
    /自己紹介|自己PR|自己ピーアール|あなた自身について|簡単に.{0,6}紹介/,
  ],
  [
    "case",
    /フェルミ|推定して|概算|見積も|市場規模|何個|何本|何台|何店舗|何人いる|ケース面接/,
  ],
  [
    "motivation",
    /志望|応募(した|の)?(理由|動機)|なぜ(当社|弊社|この会社|うち)|(当社|弊社)を選|入社(したら|後に|して)/,
  ],
  ["weakness", /弱み|短所|苦手/],
  ["strength", /強み|長所|得意/],
  ["failure", /失敗|挫折|苦労|困難/],
  ["career", /キャリア|将来|(5|10|五|十)年後|ビジョン/],
  ["management", /マネジメント|リーダー|まとめ役|率いた/],
  ["achievement", /実績|成果|受賞|達成/],
  ["technical", /研究|技術|開発|プログラミング|機械学習/],
  ["experience", /経験|学生時代|ガクチカ|力を入れ|取り組/],
  ["followUp", /^(それ|その|具体的|もう少し|詳しく)/],
];

export function guessQuestionCategory(question: string): QuestionCategory {
  const text = question.trim();
  for (const [category, pattern] of categoryRules) {
    if (pattern.test(text)) {
      return category;
    }
  }
  return "other";
}
