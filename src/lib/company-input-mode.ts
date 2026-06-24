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
      description: "",
      homeLead:
        "事前学習した自分の情報、会社名、企業Webサイト・採用情報、志望コースをもとに、",
      setupFlow:
        "企業Webサイト・採用情報などと志望コースをもとに面接前メモを作成",
      missing:
        "自分スロット、会社名、企業Webサイト・採用情報など、志望コースを入力してください。",
      placeholder: "企業サイト、採用ページ、募集要項URL",
      progress:
        "Webサイトと採用情報を確認し、自己情報に合わせた会社スロットへ整理しています。予測は約3.5分を基準にした経過時間からの推定です。",
      promptField: "企業Webサイト・採用情報など",
      schemaMissing: "企業Webサイト・採用情報などを入力してください",
    };
  }

  return {
    label: "社風・採用情報・特筆事項など(詳細)",
    shortLabel: "社風・採用情報",
    description:
      "自分スロット、会社名、社風・採用情報・特筆事項など、志望コース、その他だけで企業研究を作ります。複数社はスロットとして切り替えます。",
    homeLead:
      "事前学習した自分の情報、会社名、社風・採用情報、志望コースをもとに、",
    setupFlow: "社風・採用情報・特筆事項と志望コースをもとに面接前メモを作成",
    missing:
      "自分スロット、会社名、社風・採用情報・特筆事項など(詳細)、志望コースを入力してください。",
    placeholder:
      "例: 社風、採用で強調されている人物像、募集要項、選考で見られそうな点、特筆事項、直近のニュースメモなど",
    progress:
      "入力された社風・採用情報・特筆事項を読み、自己情報に合わせた会社スロットへ整理しています。予測は約3.5分を基準にした経過時間からの推定です。",
    promptField: "社風・採用情報・特筆事項など(詳細)",
    schemaMissing: "社風・採用情報・特筆事項などを入力してください",
  };
}
