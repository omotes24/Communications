"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Plus, Search, Trash2 } from "lucide-react";

import {
  FormField,
  inputClassName,
  textareaClassName,
} from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  companyProfileSchema,
  createEmptyCompanyProfile,
  type CompanyProfile,
  type UserProfile,
} from "@/lib/schemas/interview";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import { cn } from "@/lib/utils";

function profileToSelfInfo(profile: UserProfile | null): string {
  if (!profile) {
    return "";
  }
  return [
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

export function CompanyManager() {
  const { storage, actions } = useAppStorage();
  const activeProfile = storage.profiles[0] ?? null;
  const suggestedSelfInfo = useMemo(
    () => profileToSelfInfo(activeProfile),
    [activeProfile],
  );
  const [selfInfo, setSelfInfo] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [desiredCourse, setDesiredCourse] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [draft, setDraft] = useState<CompanyProfile>(
    createEmptyCompanyProfile(),
  );
  const [autoSelectedCompanyId, setAutoSelectedCompanyId] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!selfInfo && suggestedSelfInfo) {
      const timer = window.setTimeout(() => {
        setSelfInfo(suggestedSelfInfo);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [selfInfo, suggestedSelfInfo]);

  useEffect(() => {
    const firstCompany = storage.companies[0];
    if (
      !draft.companyName &&
      firstCompany &&
      autoSelectedCompanyId !== firstCompany.id
    ) {
      const timer = window.setTimeout(() => {
        selectCompany(firstCompany);
        setAutoSelectedCompanyId(firstCompany.id);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [storage.companies, draft.companyName, autoSelectedCompanyId]);

  async function researchAndSave() {
    if (
      !selfInfo.trim() ||
      !companyName.trim() ||
      !companyWebsite.trim() ||
      !desiredCourse.trim()
    ) {
      setStatus(
        "自分のこと、会社名、企業Webサイト、志望コースを入力してください。",
      );
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/research-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selfInfo,
          companyName,
          companyWebsite,
          desiredCourse,
          additionalNotes,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "企業調査に失敗しました");
      }
      const researched = companyProfileSchema.parse(await response.json());
      setDraft(researched);
      actions.saveCompany(researched);
      setStatus("会社スロットに保存しました。");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "企業調査に失敗しました",
      );
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setCompanyName("");
    setCompanyWebsite("");
    setDesiredCourse("");
    setAdditionalNotes("");
    setDraft(createEmptyCompanyProfile());
    setStatus(null);
  }

  function selectCompany(company: CompanyProfile) {
    setDraft(company);
    setCompanyName(company.companyName || company.label);
    setCompanyWebsite(company.researchSources[0] ?? "");
    setDesiredCourse(company.researchInstruction || company.targetRole);
    setAdditionalNotes(company.interviewFocus);
    setStatus(null);
  }

  return (
    <section>
      <PageHeader
        title="会社スロット"
        description="自分のこと、会社名、企業Webサイト、志望コース、その他だけで企業研究を作ります。複数社はスロットとして切り替えます。"
      />

      <div className="grid gap-5">
        <section className="rounded-[28px] border border-neutral-950 bg-neutral-950 p-4 text-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-400">
                Company Select
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                Choose Your Slot
              </h2>
            </div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white hover:text-neutral-950"
            >
              <Plus className="h-4 w-4" aria-hidden />
              新規
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {storage.companies.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-neutral-300 sm:col-span-2 xl:col-span-4">
                まだスロットがありません。下の5項目を入れて作成します。
              </div>
            ) : (
              storage.companies.map((company, index) => (
                <div
                  key={company.id}
                  className={cn(
                    "group rounded-3xl border p-4 transition",
                    draft.id === company.id
                      ? "border-white bg-white text-neutral-950"
                      : "border-white/10 bg-white/5 text-white hover:border-white/50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectCompany(company)}
                    className="block w-full text-left"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-500">
                      SLOT {index + 1}
                    </span>
                    <span className="mt-2 block truncate text-lg font-semibold tracking-tight">
                      {company.companyName || company.label}
                    </span>
                    <span
                      className={cn(
                        "mt-3 line-clamp-3 block text-xs leading-5",
                        draft.id === company.id
                          ? "text-neutral-600"
                          : "text-neutral-400",
                      )}
                    >
                      {company.targetRole || company.researchSummary}
                    </span>
                  </button>
                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-semibold",
                        draft.id === company.id
                          ? "text-emerald-700"
                          : "text-neutral-400",
                      )}
                    >
                      {draft.id === company.id ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      ) : null}
                      {draft.id === company.id ? "ACTIVE" : "SAVED"}
                    </span>
                    <button
                      type="button"
                      aria-label={`${company.companyName || company.label}を削除`}
                      onClick={() => actions.deleteCompany(company.id)}
                      className={cn(
                        "rounded-full p-1.5 transition",
                        draft.id === company.id
                          ? "text-red-600 hover:bg-red-50"
                          : "text-neutral-500 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form className="rounded-[28px] border border-neutral-950/10 bg-white p-5 shadow-sm sm:p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <FormField label="自分のこと">
                  <textarea
                    className={textareaClassName}
                    value={selfInfo}
                    onChange={(event) => setSelfInfo(event.target.value)}
                    placeholder="サークルで部長、システム開発経験、強み、弱みなど"
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
              <FormField label="企業Webサイト">
                <textarea
                  className={textareaClassName}
                  value={companyWebsite}
                  onChange={(event) => setCompanyWebsite(event.target.value)}
                  placeholder="企業サイト、採用ページ、募集要項URL"
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
                className="h-11 rounded-full border border-neutral-950/15 bg-white px-5 text-sm font-semibold text-neutral-900 transition hover:border-neutral-950"
              >
                自分のことを反映
              </button>
              <button
                type="button"
                onClick={researchAndSave}
                disabled={loading}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-neutral-400"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Search className="h-4 w-4" aria-hidden />
                )}
                学習用スロット作成
              </button>
            </div>

            {status ? (
              <p className="mt-4 rounded-2xl border border-neutral-950/10 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700">
                {status}
              </p>
            ) : null}
          </form>

          <aside className="rounded-[28px] border border-neutral-950/10 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-600">
              Selected
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {draft.companyName || "未作成"}
            </h2>
            <p className="mt-3 text-sm font-medium leading-7 text-neutral-600">
              {draft.researchSummary ||
                "調査するとここに短い理解メモが入ります。"}
            </p>

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
