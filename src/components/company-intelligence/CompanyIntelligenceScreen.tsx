"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  FormField,
  inputClassName,
  textareaClassName,
} from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  type CompanyIntelligenceReport,
  companyIntelligenceStartResponseSchema,
  type HallucinationAuditResult,
} from "@/lib/company-intelligence/schemas";
import {
  describeCompanyResearchUrl,
  inferCompanyNameFromUrl,
  validateCompanyResearchUrls,
} from "@/lib/company-intelligence/url-validation";
import { type CompanyProfile } from "@/lib/schemas/interview";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import { cn } from "@/lib/utils";

type ResearchStatus = "idle" | "researching" | "completed" | "blocked" | "error";

const researchSteps = [
  "公開情報を調査中",
  "確認済み情報とAI推定を分離中",
  "根拠不足の記述を監査中",
  "面接準備用レポートを作成中",
];

function buildProfileContext(
  profiles: ReturnType<typeof useAppStorage>["activeProfiles"],
) {
  return (
    profiles
      .map((profile) =>
        [
          `プロフィール名: ${profile.label}`,
          profile.nameOrAlias ? `名前: ${profile.nameOrAlias}` : "",
          profile.affiliation ? `所属: ${profile.affiliation}` : "",
          profile.currentRole ? `現在: ${profile.currentRole}` : "",
          profile.careerSummary ? `自分スロット: ${profile.careerSummary}` : "",
          profile.skills ? `スキル: ${profile.skills}` : "",
          profile.strengths ? `強み: ${profile.strengths}` : "",
          profile.achievements ? `実績: ${profile.achievements}` : "",
          profile.motivationMaterials
            ? `志望動機素材: ${profile.motivationMaterials}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n") || "プロフィール未登録"
  );
}

function reportToCompanyProfile(report: CompanyIntelligenceReport): CompanyProfile {
  const now = new Date().toISOString();
  const checkedFacts = report.checkedFacts
    .map((item) => `【${item.title}】${item.claim}`)
    .join("\n");
  const inferences = report.aiInferences
    .map((item) => `【${item.title}】${item.claim}\n根拠: ${item.basis}`)
    .join("\n");
  const unknowns = report.unknowns
    .map((item) => `【${item.topic}】${item.reason}\n確認: ${item.suggestedCheck}`)
    .join("\n");
  const reverseQuestions = report.unknowns
    .map((item) => item.suggestedCheck)
    .filter(Boolean)
    .join("\n");

  return {
    id: crypto.randomUUID(),
    label: `${report.companyName} 企業研究`,
    companyName: report.companyName,
    business: checkedFacts || report.statusSummary,
    philosophy: report.statusSummary,
    targetRole: report.jobTitle,
    jobDescription: checkedFacts,
    requiredSkills: inferences,
    interviewFocus: [
      report.statusSummary,
      inferences,
      unknowns ? `要確認:\n${unknowns}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    attraction: inferences,
    reverseQuestions,
    researchInput: [
      `企業研究・比較AI reportId: ${report.reportId}`,
      `確認できた情報:\n${checkedFacts}`,
      `AI推定:\n${inferences}`,
      `要確認:\n${unknowns}`,
    ].join("\n\n"),
    researchInstruction: report.jobTitle,
    researchSummary: report.statusSummary,
    researchSources: report.sources.map((source) => source.url),
    fitHypotheses: report.aiInferences.map((item) => item.claim),
    interviewAngles: report.unknowns.map((item) => item.suggestedCheck),
    createdAt: now,
    updatedAt: now,
  };
}

function formatSourceLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./u, "");
  } catch {
    return url;
  }
}

export function CompanyIntelligenceScreen() {
  const { ready, storage, activeProfiles, actions } = useAppStorage();
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [interest, setInterest] = useState("成長重視");
  const [status, setStatus] = useState<ResearchStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [report, setReport] = useState<CompanyIntelligenceReport | null>(null);
  const [audit, setAudit] = useState<HallucinationAuditResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const selectedCompanies = useMemo(
    () => storage.companies.slice(-5).reverse(),
    [storage.companies],
  );

  const validation = useMemo(
    () => validateCompanyResearchUrls(urlInput),
    [urlInput],
  );
  const pageTypes = useMemo(
    () => Array.from(new Set(validation.urls.map(describeCompanyResearchUrl))),
    [validation.urls],
  );
  const companyNameGuess =
    companyName.trim() ||
    (validation.urls[0] ? inferCompanyNameFromUrl(validation.urls[0]) : "");
  const canResearch =
    status !== "researching" && (companyName.trim() || urlInput.trim());

  async function startResearch() {
    const trimmedCompanyName = companyName.trim();
    const trimmedJobTitle = jobTitle.trim();
    const currentValidation = validateCompanyResearchUrls(urlInput);

    if (!trimmedCompanyName && currentValidation.urls.length === 0) {
      setStatus("error");
      setMessage("企業名またはURLを入力してください。");
      return;
    }
    if (currentValidation.errors.length > 0) {
      setStatus("error");
      setMessage(currentValidation.errors[0] ?? "URLを確認してください。");
      return;
    }

    setReport(null);
    setAudit(null);
    setSaved(false);
    setStatus("researching");
    setStepIndex(0);
    setMessage("根拠確認を優先して調査しています。数分かかることがあります。");

    const stepTimer = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, researchSteps.length - 1));
    }, 10_000);

    try {
      const response = await fetch("/api/company-intelligence/research/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": crypto.randomUUID(),
          "x-operation-id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          companyName: trimmedCompanyName || companyNameGuess,
          jobTitle: trimmedJobTitle,
          urls: currentValidation.urls,
          interest,
          selfInfo: buildProfileContext(activeProfiles),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const blockedAudit =
          data && typeof data === "object" && "audit" in data
            ? (data.audit as HallucinationAuditResult)
            : null;
        if (blockedAudit) {
          setAudit(blockedAudit);
          setStatus("blocked");
        } else {
          setStatus("error");
        }
        throw new Error(
          data && typeof data === "object" && "error" in data
            ? String(data.error)
            : "企業研究に失敗しました。",
        );
      }

      const parsed = companyIntelligenceStartResponseSchema.parse(data);
      if (parsed.status !== "completed") {
        throw new Error("企業研究ジョブが完了していません。");
      }
      if (!parsed.audit.safeToDisplay) {
        setAudit(parsed.audit);
        setStatus("blocked");
        setMessage("根拠が不足しているため表示を止めました。");
        return;
      }
      setReport(parsed.report);
      setAudit(parsed.audit);
      setStatus("completed");
      setMessage("根拠付き企業研究が完了しました。会社スロットへ保存できます。");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "企業研究に失敗しました。時間をおいて再試行してください。",
      );
      setStatus((current) => (current === "blocked" ? current : "error"));
    } finally {
      window.clearInterval(stepTimer);
    }
  }

  function saveReportToCompanySlot() {
    if (!report) {
      return;
    }
    const companyProfile = reportToCompanyProfile(report);
    actions.saveCompany(companyProfile);
    actions.setActiveCompany(companyProfile.id);
    setSaved(true);
    setMessage("会社スロットへ保存しました。面接対策でこの企業を使えます。");
  }

  return (
    <section>
      <PageHeader
        title="企業研究・比較AI"
        description="公開情報を根拠に、確認済み情報・AI推定・要確認事項を分けて企業研究を作ります。"
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                Company Intelligence
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                根拠付きDeep Research
              </h2>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                ready
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-[#f5f5f7] text-[#6e6e73]",
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {ready ? "根拠確認モード" : "読み込み中"}
            </span>
          </div>

          <div className="mt-5 grid gap-4">
            <FormField label="URL">
              <textarea
                className={`${textareaClassName} min-h-32`}
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="採用ページ、求人票、説明会ページ、IR、ニュースなどのURLを貼り付け"
              />
            </FormField>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="企業名 optional">
                <input
                  className={inputClassName}
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="例: 三菱UFJ信託銀行"
                />
              </FormField>
              <FormField label="応募職種 optional">
                <input
                  className={inputClassName}
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  placeholder="例: 総合職、データサイエンス職"
                />
              </FormField>
            </div>

            <div>
              <p className="text-sm font-semibold tracking-tight">
                価値観プリセット
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  "成長重視",
                  "安定重視",
                  "年収重視",
                  "裁量重視",
                  "勤務地重視",
                  "社会貢献重視",
                ].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setInterest(item)}
                    className={cn(
                      "inline-flex h-9 items-center rounded-full px-3 text-xs font-semibold transition",
                      interest === item
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e8e8ed] hover:text-[#1d1d1f]",
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {pageTypes.length > 0 || validation.warnings.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {pageTypes.map((item) => (
                  <span
                    key={item}
                    className="inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]"
                  >
                    {item}
                  </span>
                ))}
                {validation.warnings.map((warning) => (
                  <span
                    key={warning}
                    className="inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900"
                  >
                    {warning}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={startResearch}
                disabled={!canResearch}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[#86868b]"
              >
                {status === "researching" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Search className="h-4 w-4" aria-hidden />
                )}
                {status === "researching" ? "調査中" : "Deep Research開始"}
              </button>
              <button
                type="button"
                onClick={() => setUrlInput((current) => `${current}\n`)}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#f5f5f7] px-5 text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#e8e8ed]"
              >
                <Plus className="h-4 w-4" aria-hidden />
                URL追加
              </button>
            </div>

            {status === "researching" ? (
              <div className="rounded-2xl bg-[#f5f5f7] p-4">
                <div className="flex items-center gap-3">
                  <Loader2
                    className="h-4 w-4 animate-spin text-[var(--accent)]"
                    aria-hidden
                  />
                  <p className="text-sm font-semibold">
                    {researchSteps[stepIndex]}
                  </p>
                </div>
                <div className="mt-3 grid gap-2">
                  {researchSteps.map((step, index) => (
                    <div
                      key={step}
                      className={cn(
                        "h-1.5 rounded-full",
                        index <= stepIndex
                          ? "bg-[var(--accent)]"
                          : "bg-white",
                      )}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {message ? (
              <p
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm font-medium leading-6",
                  status === "error" || status === "blocked"
                    ? "border border-amber-200 bg-amber-50 text-amber-950"
                    : "bg-[#f5f5f7] text-[#6e6e73]",
                )}
              >
                {message}
              </p>
            ) : null}
          </div>
        </section>

        <aside className="grid gap-5">
          <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Company Slots
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              比較候補
            </h2>
            <div className="mt-4 grid gap-2">
              {selectedCompanies.length === 0 ? (
                <p className="rounded-2xl bg-[#f5f5f7] p-4 text-sm font-medium leading-6 text-[#6e6e73]">
                  会社スロットへ保存すると、ここに比較候補が表示されます。
                </p>
              ) : (
                selectedCompanies.map((company) => (
                  <div
                    key={company.id}
                    className="rounded-2xl bg-[#f5f5f7] p-4"
                  >
                    <p className="truncate text-sm font-semibold">
                      {company.companyName || company.label}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-[#6e6e73]">
                      {company.targetRole || company.researchSummary}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Quality
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              表示ルール
            </h2>
            <ul className="mt-4 grid gap-2 text-sm font-medium leading-6 text-[#6e6e73]">
              <li>・根拠URLがある情報だけを確認済みに表示</li>
              <li>・推定はAI推定として分離</li>
              <li>・待遇や選考などは要確認へ退避</li>
              <li>・危険な断定があれば表示停止</li>
            </ul>
          </section>
        </aside>
      </div>

      <div className="mt-5 grid gap-5">
        {audit && !audit.safeToDisplay ? (
          <section className="rounded-[30px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-1 h-5 w-5 shrink-0 text-amber-700"
                aria-hidden
              />
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-amber-950">
                  根拠不足のため表示を止めました
                </h2>
                <ul className="mt-3 grid gap-2 text-sm font-semibold leading-6 text-amber-950">
                  {audit.blockedReasons.map((reason) => (
                    <li key={reason}>・{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        {report ? (
          <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                  Research Result
                </p>
                <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                  {report.companyName}
                </h2>
                <p className="mt-2 max-w-3xl text-sm font-medium leading-7 text-[#6e6e73]">
                  {report.statusSummary}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveReportToCompanySlot}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1d1d1f] px-4 text-xs font-semibold text-white transition hover:bg-neutral-800"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {saved ? "保存済み" : "会社スロットに保存"}
                </button>
                <Link
                  href="/support"
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-xs font-semibold text-white transition hover:bg-[var(--accent-hover)]"
                >
                  面接対策へ
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <section className="rounded-2xl bg-[#f5f5f7] p-4">
                <h3 className="text-sm font-semibold">確認できた情報</h3>
                <div className="mt-3 grid gap-3">
                  {report.checkedFacts.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                          {item.confidence}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-7 text-[#424245]">
                        {item.claim}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] p-4">
                <h3 className="text-sm font-semibold">AI推定</h3>
                <div className="mt-3 grid gap-3">
                  {report.aiInferences.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-white/80 p-4">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-7 text-[#424245]">
                        {item.claim}
                      </p>
                      <p className="mt-2 text-xs font-semibold leading-5 text-[#6e6e73]">
                        根拠: {item.basis}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-semibold text-amber-950">
                  要確認
                </h3>
                <div className="mt-3 grid gap-3">
                  {report.unknowns.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-white p-4">
                      <p className="text-sm font-semibold text-amber-950">
                        {item.topic}
                      </p>
                      <p className="mt-2 text-sm font-medium leading-7 text-amber-950">
                        {item.reason}
                      </p>
                      <p className="mt-2 text-xs font-semibold leading-5 text-amber-900">
                        確認方法: {item.suggestedCheck}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-neutral-950/10 p-4">
                <h3 className="text-sm font-semibold">情報源</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {report.sources.map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#f5f5f7] px-3 py-1.5 text-xs font-semibold text-[#1d1d1f] hover:bg-[#e8e8ed]"
                    >
                      <span className="truncate">
                        {source.title || formatSourceLabel(source.url)}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ))}
                </div>
              </section>

              {report.researchLimitations.length > 0 ? (
                <section className="rounded-2xl bg-[#f5f5f7] p-4">
                  <h3 className="text-sm font-semibold">調査上の制約</h3>
                  <ul className="mt-3 grid gap-2 text-sm font-medium leading-6 text-[#6e6e73]">
                    {report.researchLimitations.map((item) => (
                      <li key={item}>・{item}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f5f5f7] text-[var(--accent)]">
              <BarChart3 className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Phase 1の範囲
              </h2>
              <p className="mt-2 text-sm font-medium leading-7 text-[#6e6e73]">
                URL入力、Deep Research実行、根拠付きレポート、Hallucination監査、会社スロット保存までを接続しています。
                複数社の自動ランキングは次フェーズで追加します。
              </p>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
