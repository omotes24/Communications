"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";

import {
  FormField,
  inputClassName,
  textareaClassName,
} from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  getCompanyInputCopy,
  getCompanyInputMode,
  type CompanyInputMode,
} from "@/lib/company-input-mode";
import {
  companyProfileSchema,
  createEmptyCompanyProfile,
  type CompanyProfile,
  type UserProfile,
} from "@/lib/schemas/interview";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import { cn } from "@/lib/utils";

const estimatedResearchMs = 300_000;
const maxInProgressResearchPercent = 96;
const progressRangePercent = 92;

type ResearchProgress = {
  startedAt: number;
  percent: number;
  elapsedSeconds: number;
  remainingSeconds: number;
};

function profileToSelfInfo(profile: UserProfile): string {
  return [
    profile.nameOrAlias ? `名前: ${profile.nameOrAlias}` : "",
    profile.affiliation ? `所属: ${profile.affiliation}` : "",
    profile.careerSummary,
    profile.strengths ? `強み: ${profile.strengths}` : "",
    profile.achievements ? `実績: ${profile.achievements}` : "",
    profile.successStories ? `成功経験: ${profile.successStories}` : "",
    profile.failureStories ? `苦労・失敗経験: ${profile.failureStories}` : "",
    profile.motivationMaterials
      ? `志望動機の素材: ${profile.motivationMaterials}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function profileSlotName(profile: UserProfile, profiles: UserProfile[]): string {
  const index = profiles.findIndex((item) => item.id === profile.id);
  return index >= 0 ? `SLOT ${String.fromCharCode(65 + index)}` : "SLOT";
}

function profilesToSelfInfo(
  profiles: UserProfile[],
  allProfiles: UserProfile[],
): string {
  return profiles
    .map((profile) =>
      [
        `${profileSlotName(profile, allProfiles)}: ${profile.label}`,
        profileToSelfInfo(profile),
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n---\n\n");
}

function createProgress(startedAt: number): ResearchProgress {
  const elapsedMs = Date.now() - startedAt;
  const percent = Math.min(
    maxInProgressResearchPercent,
    Math.max(
      4,
      Math.round((elapsedMs / estimatedResearchMs) * progressRangePercent),
    ),
  );
  return {
    startedAt,
    percent,
    elapsedSeconds: Math.floor(elapsedMs / 1000),
    remainingSeconds: Math.max(
      0,
      Math.ceil((estimatedResearchMs - elapsedMs) / 1000),
    ),
  };
}

function formatSeconds(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest > 0 ? `${minutes}分${rest}秒` : `${minutes}分`;
  }
  return `${seconds}秒`;
}

function extractCompanyInputFromProfile(
  company: CompanyProfile,
  mode: CompanyInputMode,
): string {
  if (mode === "url") {
    return (
      company.researchSources[0] ??
      company.researchInput
        .match(
          /企業Webサイト(?:・採用情報など)?:\s*([\s\S]*?)(?:\n志望コース:|\nその他:|$)/,
        )?.[1]
        ?.trim() ??
      ""
    );
  }

  const detailedInput =
    company.researchInput.match(
      /社風・採用情報・特筆事項など\(詳細\):\s*([\s\S]*?)(?:\n志望コース:|\nその他:|$)/,
    )?.[1] ??
    company.researchInput.match(
      /企業Webサイト(?:・採用情報など)?:\s*([\s\S]*?)(?:\n志望コース:|\nその他:|$)/,
    )?.[1] ??
    "";
  return (
    detailedInput.trim() ||
    company.researchSummary ||
    company.researchSources.join("\n")
  );
}

export function CompanyManager() {
  const companyInputMode = getCompanyInputMode();
  const companyInputCopy = getCompanyInputCopy(companyInputMode);
  const {
    storage,
    activeCompany,
    activeCompanies,
    activeProfiles,
    actions,
  } = useAppStorage();
  const suggestedSelfInfo = useMemo(
    () => profilesToSelfInfo(activeProfiles, storage.profiles),
    [activeProfiles, storage.profiles],
  );
  const [selfInfo, setSelfInfo] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyDetails, setCompanyDetails] = useState("");
  const [desiredCourse, setDesiredCourse] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [draft, setDraft] = useState<CompanyProfile>(
    createEmptyCompanyProfile(),
  );
  const [autoSelectedCompanyId, setAutoSelectedCompanyId] = useState<
    string | null
  >(null);
  const [formReady, setFormReady] = useState(false);
  const [researchProgress, setResearchProgress] =
    useState<ResearchProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const progressDoneTimer = useRef<number | null>(null);
  const researchStartedAt = researchProgress?.startedAt ?? null;

  const selectCompany = useCallback(
    (company: CompanyProfile, makeActive = false) => {
      setDraft(company);
      setCompanyName(company.companyName || company.label);
      setCompanyDetails(
        extractCompanyInputFromProfile(company, companyInputMode),
      );
      setDesiredCourse(company.researchInstruction || company.targetRole);
      setAdditionalNotes(company.interviewFocus);
      setStatus(null);
      if (makeActive) {
        actions.setActiveCompany(company.id);
      }
    },
    [actions, companyInputMode],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFormReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!formReady) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setSelfInfo(suggestedSelfInfo);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [formReady, suggestedSelfInfo]);

  useEffect(() => {
    const companyToSelect = activeCompany;
    if (
      !draft.companyName &&
      companyToSelect &&
      autoSelectedCompanyId !== companyToSelect.id
    ) {
      const timer = window.setTimeout(() => {
        selectCompany(companyToSelect);
        setAutoSelectedCompanyId(companyToSelect.id);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [
    activeCompany,
    storage.companies,
    draft.companyName,
    autoSelectedCompanyId,
    selectCompany,
  ]);

  useEffect(() => {
    if (!loading || !researchStartedAt) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setResearchProgress(createProgress(researchStartedAt));
    }, 500);
    return () => window.clearInterval(timer);
  }, [loading, researchStartedAt]);

  useEffect(() => {
    return () => {
      if (progressDoneTimer.current) {
        window.clearTimeout(progressDoneTimer.current);
      }
    };
  }, []);

  function finishProgress() {
    if (progressDoneTimer.current) {
      window.clearTimeout(progressDoneTimer.current);
    }
    setResearchProgress((current) => {
      const startedAt = current?.startedAt ?? Date.now();
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      return {
        startedAt,
        percent: 100,
        elapsedSeconds,
        remainingSeconds: 0,
      };
    });
    progressDoneTimer.current = window.setTimeout(() => {
      setResearchProgress(null);
    }, 1600);
  }

  async function researchAndSave() {
    if (
      !selfInfo.trim() ||
      !companyName.trim() ||
      !companyDetails.trim() ||
      !desiredCourse.trim()
    ) {
      setStatus(companyInputCopy.missing);
      return;
    }
    setLoading(true);
    setStatus(null);
    if (progressDoneTimer.current) {
      window.clearTimeout(progressDoneTimer.current);
      progressDoneTimer.current = null;
    }
    setResearchProgress(createProgress(Date.now()));
    try {
      const response = await fetch("/api/research-company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-operation-id": crypto.randomUUID(),
          "x-request-id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          selfInfo,
          companyName,
          companyWebsite: companyDetails,
          desiredCourse,
          additionalNotes,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "企業調査に失敗しました");
      }
      const researched = companyProfileSchema.parse(await response.json());
      const existingCompany = storage.companies.find(
        (company) => company.id === draft.id,
      );
      const companyToSave = existingCompany
        ? {
            ...researched,
            id: existingCompany.id,
            createdAt: existingCompany.createdAt,
          }
        : researched;
      setDraft(companyToSave);
      actions.saveCompany(companyToSave);
      setAutoSelectedCompanyId(companyToSave.id);
      setStatus("会社スロットに保存しました。");
      finishProgress();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "企業調査に失敗しました",
      );
      setResearchProgress(null);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setCompanyName("");
    setCompanyDetails("");
    setDesiredCourse("");
    setAdditionalNotes("");
    setDraft(createEmptyCompanyProfile());
    setStatus(null);
  }

  function deleteCompany(id: string) {
    actions.deleteCompany(id);
    if (draft.id === id) {
      reset();
      setAutoSelectedCompanyId(null);
    }
  }

  return (
    <section>
      <PageHeader
        title="会社スロット"
        description={companyInputCopy.description}
      />

      <div className="grid gap-5">
        <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                Company Select
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#1d1d1f]">
                会社スロットを選ぶ
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#f5f5f7] px-4 text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#e8e8ed]"
              >
                <Plus className="h-4 w-4" aria-hidden />
                新規
              </button>
              <Link
                href="/company/intelligence"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
              >
                <BarChart3 className="h-4 w-4" aria-hidden />
                企業研究AI
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {storage.companies.length === 0 ? (
              <div className="rounded-3xl bg-[#f5f5f7] p-5 text-sm font-medium text-[#6e6e73] sm:col-span-2 xl:col-span-4">
                まだスロットがありません。下の5項目を入れて作成します。
              </div>
            ) : (
              storage.companies.map((company, index) => (
                <div
                  key={company.id}
                  className={cn(
                    "group rounded-3xl p-4 ring-1 ring-black/[0.06] transition",
                    draft.id === company.id
                      ? "bg-[#f5f5f7] text-[#1d1d1f]"
                      : "bg-white text-[#1d1d1f] hover:bg-[#fbfbfd]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectCompany(company)}
                    className="block w-full text-left"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                        SLOT {index + 1}
                      </span>
                      {activeCompanies.some((item) => item.id === company.id) ? (
                        <CheckCircle2
                          className="h-4 w-4 text-emerald-600"
                          aria-hidden
                        />
                      ) : null}
                    </span>
                    <span className="mt-2 block truncate text-lg font-semibold tracking-tight">
                      {company.companyName || company.label}
                    </span>
                    <span
                      className={cn(
                        "mt-3 line-clamp-3 block text-xs leading-5",
                        draft.id === company.id
                          ? "text-[#6e6e73]"
                          : "text-[#86868b]",
                      )}
                    >
                      {company.targetRole || company.researchSummary}
                    </span>
                  </button>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="grid gap-1">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[11px] font-semibold",
                          activeCompanies.some((item) => item.id === company.id)
                            ? "text-emerald-700"
                            : "text-[#86868b]",
                        )}
                      >
                        {activeCompanies.some((item) => item.id === company.id) ? (
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        ) : null}
                        {activeCompanies.some((item) => item.id === company.id)
                          ? "使用中"
                          : "保存済み"}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] font-semibold",
                          storage.learning?.companyId === company.id
                            ? "text-emerald-700"
                            : draft.id === company.id
                              ? "text-[#6e6e73]"
                              : "text-[#86868b]",
                        )}
                      >
                        {storage.learning?.companyId === company.id
                          ? "学習済み"
                          : "未学習"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => actions.toggleSelectedCompany(company.id)}
                        className={cn(
                          "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition",
                          activeCompanies.some((item) => item.id === company.id)
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e8e8ed]",
                        )}
                      >
                        {activeCompanies.some((item) => item.id === company.id) ? (
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        ) : null}
                        {activeCompanies.some((item) => item.id === company.id)
                          ? "使用中"
                          : "使用"}
                      </button>
                      <button
                        type="button"
                        aria-label={`${company.companyName || company.label}を削除`}
                        onClick={() => deleteCompany(company.id)}
                        className={cn(
                          "rounded-full p-1.5 transition",
                          draft.id === company.id
                            ? "text-red-600 hover:bg-red-50"
                            : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]",
                        )}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06] sm:p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <p className="rounded-2xl bg-[#f5f5f7] px-4 py-3 text-sm font-medium text-[#6e6e73] md:col-span-2">
                入力途中の内容はこのブラウザに自動保存されます。別タブへ移動しても、戻ると続きから編集できます。
              </p>
              <div className="md:col-span-2">
                <FormField label="自分スロット">
                  <div className="mb-3 rounded-2xl border border-neutral-950/10 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6e6e73]">
                        <UserRound className="h-3.5 w-3.5" aria-hidden />
                        使用する自分スロット
                      </span>
                      <span className="text-xs font-semibold text-[#86868b]">
                        {activeProfiles.length}件選択中
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-medium leading-5 text-[#86868b]">
                      面接ページの回答チャット内の選択と同期します。
                    </p>
                    {storage.profiles.length === 0 ? (
                      <p className="mt-2 text-xs font-semibold text-[#86868b]">
                        自分スロット未作成
                      </p>
                    ) : (
                      <div className="mt-3 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                        {storage.profiles.map((profile, index) => {
                          const selected = activeProfiles.some(
                            (item) => item.id === profile.id,
                          );
                          return (
                            <button
                              key={profile.id}
                              type="button"
                              onClick={() =>
                                actions.toggleSelectedProfile(profile.id)
                              }
                              aria-pressed={selected}
                              className={cn(
                                "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition",
                                selected
                                  ? "bg-[#1d1d1f] text-white"
                                  : "bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e8e8ed] hover:text-[#1d1d1f]",
                              )}
                            >
                              {selected ? (
                                <CheckCircle2
                                  className="h-3.5 w-3.5"
                                  aria-hidden
                                />
                              ) : (
                                <span
                                  className="h-3.5 w-3.5 rounded-full ring-1 ring-[#c7c7cc]"
                                  aria-hidden
                                />
                              )}
                              <span className="truncate">
                                SLOT {String.fromCharCode(65 + index)}:{" "}
                                {profile.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <textarea
                    className={`${textareaClassName} min-h-60`}
                    value={selfInfo}
                    onChange={(event) => setSelfInfo(event.target.value)}
                    placeholder="サークルで部長、システム開発経験、強み、弱みなど"
                    readOnly={storage.profiles.length > 0}
                  />
                </FormField>
              </div>
              <FormField label="会社名">
                <input
                  className={inputClassName}
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="例: サイバーエージェント"
                />
              </FormField>
              <FormField label={companyInputCopy.label}>
                <textarea
                  className={`${textareaClassName} min-h-36`}
                  value={companyDetails}
                  onChange={(event) => setCompanyDetails(event.target.value)}
                  placeholder={companyInputCopy.placeholder}
                />
              </FormField>
              <FormField label="志望コース">
                <textarea
                  className={`${textareaClassName} min-h-28`}
                  value={desiredCourse}
                  onChange={(event) => setDesiredCourse(event.target.value)}
                  placeholder="例: ビジネス職 デジタルマーケティングコース"
                />
              </FormField>
              <FormField label="その他">
                <textarea
                  className={`${textareaClassName} min-h-28`}
                  value={additionalNotes}
                  onChange={(event) => setAdditionalNotes(event.target.value)}
                  placeholder="質問の特徴、言いたいこと、避けたい話題など"
                />
              </FormField>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelfInfo(suggestedSelfInfo)}
                className="h-11 rounded-full bg-[#f5f5f7] px-5 text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#e8e8ed]"
              >
                同期し直す
              </button>
              <button
                type="button"
                onClick={researchAndSave}
                disabled={loading}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[#86868b]"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Search className="h-4 w-4" aria-hidden />
                )}
                {loading ? "学習中..." : "学習用スロット作成"}
              </button>
            </div>

            {researchProgress ? (
              <div
                className="mt-4 rounded-2xl bg-[var(--accent-soft)] p-4"
                role="status"
                aria-live="polite"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-neutral-950">
                  <span>企業研究中 {researchProgress.percent}%</span>
                  <span className="text-neutral-600">
                    {loading
                      ? researchProgress.remainingSeconds > 0
                        ? `予測残り 約${formatSeconds(researchProgress.remainingSeconds)}`
                        : "予測残り まもなく"
                      : `完了 ${formatSeconds(researchProgress.elapsedSeconds)}`}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
                    style={{ width: `${researchProgress.percent}%` }}
                  />
                </div>
                <p className="mt-3 text-xs font-medium leading-5 text-neutral-600">
                  {companyInputCopy.progress}
                </p>
              </div>
            ) : null}

            {status ? (
              <p className="mt-4 rounded-2xl border border-neutral-950/10 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700">
                {status}
              </p>
            ) : null}
          </form>

          <aside className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Selected
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {draft.companyName || "未作成"}
            </h2>
            <p className="mt-3 text-sm font-medium leading-7 text-neutral-600">
              {draft.researchSummary ||
                "調査するとここに短い理解メモが入ります。"}
            </p>
            {draft.companyName ? (
              <p
                className={cn(
                  "mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold",
                  storage.learning?.companyId === draft.id
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-neutral-100 text-neutral-600",
                )}
              >
                {storage.learning?.companyId === draft.id
                  ? "この会社は学習済み"
                  : "この会社は未学習"}
              </p>
            ) : null}

            <details className="mt-5 rounded-2xl border border-neutral-950/10 bg-neutral-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                詳細メモ
              </summary>
              <div className="mt-4 grid gap-4 text-sm leading-6 text-neutral-700">
                {draft.fitHypotheses.length > 0 ? (
                  <div>
                    <p className="font-semibold text-neutral-950">
                      自己情報との接続
                    </p>
                    <ul className="mt-2 grid gap-2">
                      {draft.fitHypotheses.map((item) => (
                        <li key={item}>・{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {draft.interviewAngles.length > 0 ? (
                  <div>
                    <p className="font-semibold text-neutral-950">
                      面接で使う切り口
                    </p>
                    <ul className="mt-2 grid gap-2">
                      {draft.interviewAngles.map((item) => (
                        <li key={item}>・{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {draft.reverseQuestions ? (
                  <div>
                    <p className="font-semibold text-neutral-950">逆質問</p>
                    <p className="mt-2 whitespace-pre-wrap">
                      {draft.reverseQuestions}
                    </p>
                  </div>
                ) : null}
              </div>
            </details>
          </aside>
        </div>
      </div>
    </section>
  );
}
