import type {
  AnswerLanguage,
  CompanyProfile,
  GenerateAnswerRequest,
  UserProfile,
} from "@/lib/schemas/interview";

const profileLabels: Array<[keyof UserProfile, string]> = [
  ["nameOrAlias", "氏名または呼称"],
  ["affiliation", "大学・学年・学部・研究室など"],
  ["currentRole", "現在の職種"],
  ["careerSummary", "経歴概要"],
  ["workHistory", "職歴"],
  ["skills", "スキル"],
  ["strengths", "強み"],
  ["weaknesses", "弱み"],
  ["achievements", "実績"],
  ["metrics", "成果数値"],
  ["successStories", "成功経験"],
  ["failureStories", "失敗経験"],
  ["managementExperience", "マネジメント経験"],
  ["careerChangeReason", "転職理由"],
  ["motivationMaterials", "志望動機の素材"],
  ["preferredTone", "希望する話し方"],
  ["forbiddenInformation", "回答で絶対に使わない情報"],
];

const companyLabels: Array<[keyof CompanyProfile, string]> = [
  ["companyName", "会社名"],
  ["business", "事業内容"],
  ["philosophy", "企業理念"],
  ["targetRole", "応募職種"],
  ["jobDescription", "求人票"],
  ["requiredSkills", "求められるスキル"],
  ["interviewFocus", "面接で重視されそうな事項"],
  ["attraction", "ユーザーが感じている企業の魅力"],
  ["reverseQuestions", "逆質問候補"],
  ["researchSummary", "企業調査サマリー"],
];

const fermiEstimationGuide = [
  "フェルミ推定モード:",
  "フェルミ推定とは、直接データがない、または調べられない未知の数量を、限られた一般知識と仮定を使って論理的に分解し、概算する問題である。",
  "未知の量Qを関連する要素 x1, x2, ..., xn に分解し、妥当な仮定を置いて Q ≈ f(x1, x2, ..., xn) としてオーダーまたは近似値を推定する。",
  "最重要ルール: 国土交通省、総務省、政府統計、業界団体、調査データなど、ユーザーが提示していない出典名や統計データを絶対に持ち出さない。",
  "最重要ルール: 『データから』『統計によると』『公表値では』『実際には』のように、外部データを参照したかのような表現を使わない。",
  "使ってよい数値は、このフェルミ推定モードに書かれた基礎数値、質問文に含まれる数値、ユーザー登録情報に含まれる数値、または回答中で明示的に『仮に〜と置く』と宣言した仮定だけである。",
  "基礎数値にない量が必要な場合は、出典を作らず、『ここでは仮に〜と置きます』と置く。仮定は丸い数でよい。",
  "正確な答えを当てることより、問題の構造化、妥当な仮定、論理の飛躍の少なさ、現実感のあるオーダー、どの変数が結果に効くかを重視する。",
  "回答では、まず式に分解し、次に仮定を置き、概算し、最後に結果の現実感と感度の大きい変数を述べる。",
  "望ましい型: 『分解式 → 仮定 → 計算 → 結論 → 感度』。各仮定は、外部データではなく自分で置いた前提として書く。",
  "例: 日本にあるコンビニの1日のコーヒー販売数 = コンビニ店舗数 × 1店舗あたり来客数 × コーヒー購入率。",
  "電柱本数のような問題では、道路総延長など未提示の公的データを持ち出さず、世帯数、国土面積、市区町村数などの基礎数値から分解する。例: 世帯数 ÷ 1本あたりが支える世帯数 + 事業所・公共施設分。",
  "禁止例: 『国土交通省のデータから道路総延長は約120万km』。これはフェルミ推定ではなく、未提示データの引用に見えるため使わない。",
  "日本の基礎数値: 人口1.25億人、2050年1億人、2060年9000万人、平均寿命84歳、世帯5000万戸、平均世帯人数2.5人、国土面積38万平方km、平地30%、山岳70%。",
  "学校数: 小学校2万校、中学校1万校、高校5000校、短期大学300校、大学750校。",
  "企業数: 大企業1.1万社、中企業55万社、小企業330万社。自治体: 市800、町750、村200。",
  "労働・所得: 給与所得者5000万人、平均年収430万円、若年フリーター200万人、フリーター平均年収100万円。",
  "人口構成: 0-14歳12%、15-64歳60%、65歳以上28%。",
  "世界の基礎数値: 人口76億人、2050年95億人、2100年112億人、地球の直径1.2万km、円周4万km、表面積5億平方km、海70%、陸30%。",
].join("\n");

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(" / ");
  }
  return typeof value === "string" ? value : "";
}

function formatSection<T extends object>(
  title: string,
  data: T | null,
  labels: Array<[keyof T, string]>,
  options: { suppressMissingLabel?: boolean } = {},
): string {
  if (!data) {
    return options.suppressMissingLabel
      ? `${title}: 面接前理解メモを優先して参照`
      : `${title}: 入力なし。近い登録情報と一般的な面接回答の型から自然に補う`;
  }
  const lines = labels
    .map(([key, label]) => {
      const value = formatValue(data[key]).trim();
      return value ? `- ${label}: ${value}` : null;
    })
    .filter(Boolean);
  return [`${title}:`, ...lines].join("\n");
}

function formatMultiSection<T extends { label?: string }>(
  title: string,
  items: T[],
  labels: Array<[keyof T, string]>,
): string {
  if (items.length === 0) {
    return `${title}: 入力なし。近い登録情報と一般的な面接回答の型から自然に補う`;
  }
  return [
    `${title}:`,
    ...items.map((item, index) => {
      const lines = labels
        .map(([key, label]) => {
          const value = formatValue(item[key]).trim();
          return value ? `- ${label}: ${value}` : null;
        })
        .filter(Boolean);
      return [
        `【SLOT ${index + 1}: ${item.label || "未命名"}】`,
        ...lines,
      ].join("\n");
    }),
  ].join("\n\n");
}

export function buildEvidenceBlock(
  profile: UserProfile | null,
  company: CompanyProfile | null,
): string {
  return [
    formatSection("ユーザー登録情報", profile, profileLabels),
    formatSection("応募企業・求人情報", company, companyLabels),
  ].join("\n\n");
}

export function buildAnswerInstructions(
  language: AnswerLanguage = "ja",
): string {
  const baseRules = [
    "あなたは日本語の面接回答コーチです。",
    "ユーザーが登録した経歴、実績、スキル、応募企業情報を芯にして、面接でそのまま話せる回答案を作成してください。",
    "",
    "ルール:",
    "1. どんな質問でも必ず回答本文を書く",
    "2. 登録情報が薄い場合も、自然な面接回答になる範囲で一般化して補う",
    "3. 回答は原則として結論から始める",
    "4. 経験を問われた場合は STAR 形式を参考にする",
    "5. 自然な話し言葉の日本語にする",
    "6. 過度に完璧な回答や不自然な美辞麗句を避ける",
    "7. 質問に直接答える",
    "8. 文字数指定がない場合は原則250〜350文字に収める。文字数指定がある場合は指定に近づける",
    "9. 同じ情報を繰り返さない",
    "10. 他人になりすました回答を作らない",
    "11. 回答本文には、根拠不足、未登録、不足情報、推測であることを説明しない",
    "12. evidenceUsed と missingInformation は内部管理用として最小限にし、回答本文には出さない",
    "13. 捻った質問でも、登録情報から一番近い経験に接続して答える",
    "14. 長文質問では、前置きや確認文を捨て、最後に聞かれている主質問へ直接答える",
    "15. 深掘り質問では、直近会話の回答内容を踏まえ、同じ話を繰り返さず一段具体化する",
    "15a. 直近会話ですでに使った体験談を再度使う場合は、背景説明・状況説明を1文以内に省略し、前回との差分、学び、意思決定、工夫、反省、企業との接続など新しい角度を中心に答える",
    "15b. 同じ体験談を続けて使う必要がない場合は、登録情報から別の体験談を優先して選ぶ",
    "15c. 同じ体験談を使う場合でも、回答本文の半分以上を既出説明の焼き直しにしない",
    "16. フェルミ推定やケース面接では、前提、概算、結論、面接での補足を短く順に示す",
    "16a. フェルミ推定モードがONのときは、ユーザーが提示していない公的データ名、調査名、統計値、出典名を作らない。必要な数値は必ず『仮に〜と置く』と明示する",
    "16b. フェルミ推定モードがONのときは、『国土交通省のデータ』『統計によると』『公表値では』のような出典参照表現を使わない",
    "17. 自分スロット追加メモがある場合は、登録プロフィールよりも当日の制約・前提として優先する",
    "18. 回答本文では、面接で特に強調すべき重要語句または重要文を最大3箇所だけ **...** で囲む",
  ];

  if (language === "en") {
    return [
      ...baseRules,
      "",
      "英語面接モード:",
      "19. 質問は日本語訳として渡される場合がある。質問の意味を保ったまま、回答本文 answer は自然な英語で書く",
      "20. talkingPoints、evidenceUsed、missingInformation、caution も英語で書く",
      "21. draft.question は入力された質問文をそのまま保持してよい。日本語訳が渡された場合は日本語のまま保持する",
      "22. 英語回答は面接でそのまま話せる口語的で簡潔な表現にする。直訳調、不自然な日本語英語を避ける",
      "23. 回答本文では、重要語句または重要文を最大3箇所だけ **...** で囲む",
    ].join("\n");
  }

  return baseRules.join("\n");
}

function formatConversationContext(
  conversationContext: GenerateAnswerRequest["conversationContext"],
): string {
  if (!conversationContext || conversationContext.length === 0) {
    return "直近会話: なし";
  }
  return [
    "直近会話:",
    "注意: 直近会話に出た体験談を再度使う場合は、既出の背景説明を省略し、新しい観点・深掘り・差分だけを中心に回答する。",
    ...conversationContext.map((turn, index) =>
      [
        `${index + 1}. 面接官: ${turn.question}`,
        `   応募者: ${turn.answer}`,
      ].join("\n"),
    ),
  ].join("\n");
}

export function buildAnswerInput(request: GenerateAnswerRequest): string {
  const hasLearningBrief = Boolean(request.learningBrief.trim());
  const selfSlot = request.selfSlot?.trim();
  const profiles = request.profiles?.length
    ? request.profiles
    : request.profile
      ? [request.profile]
      : [];
  const companies = request.companies?.length
    ? request.companies
    : request.company
      ? [request.company]
      : [];
  const answerMode =
    request.answerModelMode === "fermi"
      ? "高精度 フェルミ・ケース推論"
      : "高速 標準回答";
  const fermiGuide = request.fermiEstimationMode
    ? fermiEstimationGuide
    : "フェルミ推定モード: OFF";
  const lengthTarget = request.answerLengthTarget
    ? `目標文字数: ${request.answerLengthTarget}文字程度`
    : "目標文字数: 指定なし";
  const answerLanguage =
    request.answerLanguage === "en"
      ? "回答言語: English。質問は日本語訳として扱い、回答本文は英語で作る"
      : "回答言語: 日本語";
  return [
    `質問: ${request.question}`,
    `分類: ${request.category}`,
    `回答モード: ${answerMode}`,
    answerLanguage,
    fermiGuide,
    lengthTarget,
    formatConversationContext(request.conversationContext),
    "",
    selfSlot
      ? `自分スロット追加メモ: ${selfSlot}`
      : "自分スロット追加メモ: なし",
    "",
    request.learningBrief
      ? `面接前理解メモ: ${request.learningBrief}`
      : "面接前理解メモ: 未作成",
    "",
    hasLearningBrief
      ? [
          profiles.length > 0
            ? formatMultiSection(
                "選択中の自分スロット",
                profiles,
                profileLabels,
              )
            : formatSection(
                "ユーザー登録情報",
                request.profile,
                profileLabels,
                {
                  suppressMissingLabel: true,
                },
              ),
          companies.length > 0
            ? formatMultiSection(
                "選択中の会社スロット",
                companies,
                companyLabels,
              )
            : formatSection(
                "応募企業・求人情報",
                request.company,
                companyLabels,
                {
                  suppressMissingLabel: true,
                },
              ),
        ].join("\n\n")
      : [
          formatMultiSection("選択中の自分スロット", profiles, profileLabels),
          formatMultiSection("選択中の会社スロット", companies, companyLabels),
        ].join("\n\n"),
  ].join("\n");
}
