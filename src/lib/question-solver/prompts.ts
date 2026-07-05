import type {
  DetectedQuestion,
  SolveQuestionRequest,
  VisualExtraction,
} from "@/lib/question-solver/schemas";

export const QUESTION_SOLVER_INSTRUCTIONS = [
  "あなたは中学3年生から高校2年生向けの学習支援AIです。",
  "ユーザー自身が作成・管理する問題ページから抽出された問題だけを扱います。",
  "問題文に含まれない情報を勝手に補わないでください。",
  "問題文が不足している場合はneedsReviewをtrueにし、warningsに不足点を書いてください。",
  "Webテスト画面では、現在表示されている1問だけを解いてください。ページ見出し、ナビゲーション、広告、前後の問題、拡張機能UIは無視してください。",
  "入力欄に既に文字が入っていても、それを正答として扱わず、問題文・表・図から自分で解いてください。",
  "数学では解答モードに従い、必要な場合だけ途中式を示し、最終答案を明確にしてください。",
  "国語では本文根拠を示し、選択肢問題では各選択肢の良し悪しを簡潔に説明してください。",
  "選択肢問題ではselectedChoiceIdsに選択肢IDを入れてください。選択肢がない場合はnullにしてください。",
  "記述問題では模範解答をfinalAnswerに入れてください。",
  "自信が低い場合はconfidenceを下げてください。",
  "数式候補にTeX/LaTeXがある場合は、DOM抽出テキストより数式候補を優先して解釈してください。",
  "表はDOM抽出テキスト、ユーザー手入力補足、手動添付画像のいずれかから読み取れる行・列・数値を根拠にしてください。",
  "画像OCR/視覚読み取り結果がある場合は、それを画像内の表・グラフを構造化した一次情報として最優先で使ってください。",
  "画像OCR/視覚読み取り結果に表の行・列・数値が含まれている場合、DOM抽出テキストに表がなくても、その表を使って解いてください。",
  "手動添付画像がある場合は、DOM抽出テキストに表の数値がなくても、その画像を一次情報として表・グラフ・図を読み取ってください。",
  "グラフや画像化された表がDOMにも手動添付画像にも含まれない場合は、推測で解かずneedsReviewをtrueにしてください。",
  "ユーザーが表・グラフ補足を入力している場合、その補足は画面上の図表を手で写した情報として扱い、問題文・選択肢と合わせて解いてください。",
  "ユーザーが手動で画像を添付している場合は、その画像を表・グラフ・図の補足として読み取り、DOM抽出テキストと照合して解いてください。画像が不鮮明、欠けている、または問題文と矛盾する場合はneedsReviewをtrueにしてください。",
  "分数、添字、指数、対数、数列、極限、平方根はTeX/LaTeXの構造を保って解いてください。",
  "出力は必ず指定JSONスキーマに従ってください。",
].join("\n");

export const VISUAL_EXTRACTION_INSTRUCTIONS = [
  "あなたはWebテスト画面の画像から、現在表示されている1問の表・グラフ・図・本文・選択肢を読み取るOCR補助AIです。",
  "解答はまだ行わず、画像内で読める情報だけを構造化してください。",
  "ブラウザのアドレスバー、タブ、拡張機能のサイドパネル、右側のAI回答欄、ナビゲーション、広告、前後の問題は無視してください。",
  "中央の問題領域にある本文、条件、表、グラフ、図、選択肢だけを対象にしてください。",
  "表は行見出し、列見出し、単位、人/円/%などを保ってMarkdown表にしてください。",
  "表の各セルはcellsにも row / column / value として展開してください。",
  "P、Q、X、Y、Zなどの未知数は数値に置き換えず、そのまま値として残してください。",
  "画像から読めない値は推測せず、warningsに不足点を書いてください。",
  "選択肢が画像にある場合はextractedTextへ選択肢も含めてください。",
  "出力は必ず指定JSONスキーマに従ってください。",
].join("\n");

export function buildVisualExtractionInput(question: DetectedQuestion): string {
  return [
    `ページタイトル: ${question.pageTitle}`,
    `ページURL: ${question.pageUrl}`,
    `科目: ${question.subject}`,
    `問題種別: ${question.answerType}`,
    question.passage ? `DOM本文:\n${question.passage}` : "",
    `DOM問題文:\n${question.stem}`,
    question.visualContext
      ? `ユーザー手入力の表・グラフ補足:\n${question.visualContext}`
      : "",
    question.choices?.length
      ? [
          "DOM選択肢:",
          ...question.choices.map((choice) => `${choice.id}. ${choice.text}`),
        ].join("\n")
      : "",
    question.mathLatex?.length
      ? ["DOM TeX/LaTeX 数式候補:", ...question.mathLatex].join("\n")
      : "",
    "画像を読み取り、現在の問題に必要な表・図・グラフ・選択肢を構造化してください。",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function formatVisualExtraction(extraction: VisualExtraction): string {
  return [
    `信頼度: ${Math.round(extraction.confidence * 100)}%`,
    extraction.extractedText ? `抽出テキスト:\n${extraction.extractedText}` : "",
    extraction.tableMarkdown ? `表:\n${extraction.tableMarkdown}` : "",
    extraction.graphDescription
      ? `グラフ・図の説明:\n${extraction.graphDescription}`
      : "",
    extraction.cells.length
      ? [
          "セル一覧:",
          ...extraction.cells.map(
            (cell) => `- ${cell.row} / ${cell.column}: ${cell.value}`,
          ),
        ].join("\n")
      : "",
    extraction.warnings.length
      ? ["読み取り注意:", ...extraction.warnings.map((warning) => `- ${warning}`)].join(
          "\n",
        )
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildQuestionSolverInput(
  body: SolveQuestionRequest,
  options: { extractedVisualContext?: string } = {},
): string {
  const { question } = body;
  return [
    `解答モード: ${body.mode}`,
    `言語: ${body.language}`,
    `検知元: ${question.source}`,
    `検知信頼度: ${question.confidence}`,
    `科目: ${question.subject}`,
    `学年: ${question.gradeLevel}`,
    `問題種別: ${question.answerType}`,
    `ページタイトル: ${question.pageTitle}`,
    `ページURL: ${question.pageUrl}`,
    question.passage ? `本文:\n${question.passage}` : "",
    `問題文:\n${question.stem}`,
    question.visualContext
      ? `表・グラフ補足（ユーザー手入力）:\n${question.visualContext}`
      : "",
    options.extractedVisualContext
      ? `画像OCR/視覚読み取り結果:\n${options.extractedVisualContext}`
      : "",
    question.visualImageDataUrl
      ? "手動添付画像: あり。必ず画像を確認し、画像内の表・グラフ・図・選択肢を読み取ってください。DOM抽出テキストに表の数値がなくても、画像から読める場合は画像を根拠に解いてください。"
      : "",
    question.choices?.length
      ? [
          "選択肢:",
          ...question.choices.map((choice) => `${choice.id}. ${choice.text}`),
        ].join("\n")
      : "",
    question.mathLatex?.length
      ? ["TeX/LaTeX 数式候補:", ...question.mathLatex].join("\n")
      : "",
    "DOM抽出テキスト:",
    question.rawText,
    "モード別方針:",
    "- answer_only: 最終解答中心。途中式とstepsは最小限にし、explanationも短くする。",
    "- hint: 正答を直接出しすぎず、考え方を示す。",
    "- explanation: 解答と解説をバランスよく出す。",
    "- step_by_step: 数学は途中式を詳しく、国語は根拠整理を詳しく出す。",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function createMockSolvedQuestion(body: SolveQuestionRequest) {
  const firstChoice = body.question.choices?.[0];
  return {
    questionId: body.question.questionId,
    detectedSubject: body.question.subject,
    answerType: body.question.answerType,
    finalAnswer:
      body.mode === "hint"
        ? "まず、問題文の条件と選択肢の違いを整理してください。"
        : (firstChoice?.text ?? "問題文の条件を整理したうえで解答します。"),
    selectedChoiceIds: firstChoice ? [firstChoice.id] : null,
    explanation:
      body.mode === "hint"
        ? "このモードでは答えを直接出しすぎず、どこに注目すべきかを示します。"
        : "モック回答です。実APIではGPT-5.5が問題文・本文・選択肢をもとに解答と解説を返します。",
    steps: [
      {
        title: "条件整理",
        content: "問題文、本文、選択肢、数式を分けて確認します。",
      },
      {
        title: "解法",
        content: "根拠となる条件から、最も整合する答えを選びます。",
      },
    ],
    confidence: Math.min(0.9, Math.max(0.4, body.question.confidence)),
    needsReview: body.question.confidence < 0.7,
    warnings:
      body.question.confidence < 0.7
        ? ["問題文の検知が不完全な可能性があります。"]
        : [],
    learningPoints: ["問題文の条件を分解してから解くこと。"],
  };
}
