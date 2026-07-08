export type CompanyInputMode = "details" | "url";

export function getCompanyInputMode(): CompanyInputMode {
  return process.env.NEXT_PUBLIC_COMPANY_INPUT_MODE === "url"
    ? "url"
    : "details";
}

export function getCompanyInputCopy(mode = getCompanyInputMode()) {
  if (mode === "url") {
    return {
      label: "企業Webサイト・採用情報など",
      shortLabel: "企業Webサイト・採用情報",
      description:
        "志望企業のWebサイトや採用ページのURLを登録すると、AIが社風・求める人物像を読み取り、自分スロットと組み合わせて面接前メモを自動で作成します。",
      homeLead:
        "事前学習した自分の情報、会社名、企業Webサイト・採用情報、志望コースをもとに、",
      setupFlow:
        "企業Webサイト・採用情報などと志望コースをもとに面接前メモを作成",
      missing:
        "自分スロット、会社名、企業Webサイト・採用情報など、志望コースを入力してください。",
      placeholder: "企業サイト、採用ページ、募集要項URL",
      progress:
        "Webサイト、採用情報、ニュースなどを確認し、自己情報に合わせた会社スロットへ整理しています。通常2〜5分程度かかります。",
      promptField: "企業Webサイト・採用情報など",
      schemaMissing: "企業Webサイト・採用情報などを入力してください",
    };
  }

  return {
    label: "社風・採用情報・URL・特筆事項など(詳細)",
    shortLabel: "社風・採用情報・URL",
    description:
      "社風・採用情報・URL・特筆事項などを詳しく登録するほど、AIが自分スロットと組み合わせて精度の高い面接前メモを作成します。",
    homeLead:
      "事前学習した自分の情報、会社名、社風・採用情報、志望コースをもとに、",
    setupFlow:
      "社風・採用情報・URL・特筆事項と志望コースをもとに面接前メモを作成",
    missing:
      "自分スロット、会社名、社風・採用情報・URL・特筆事項など(詳細)、志望コースを入力してください。",
    placeholder:
      "例: 採用ページURL、募集要項URL、社風、採用で強調されている人物像、選考で見られそうな点、特筆事項、直近のニュースメモなど",
    progress:
      "入力されたURL、社風、採用情報、特筆事項、ニュースなどを確認し、自己情報に合わせた会社スロットへ整理しています。通常2〜5分程度かかります。",
    promptField: "社風・採用情報・URL・特筆事項など(詳細)",
    schemaMissing: "社風・採用情報・URL・特筆事項などを入力してください",
  };
}
