"use client";

import { useState } from "react";
import { Brain, Building2, CheckCircle2, Loader2, X } from "lucide-react";

import { useAppStorage } from "@/lib/storage/use-app-storage";

type LearningLanguage = "ja" | "en";

export function PreInterviewLearningPanel({
  learningLanguage = "ja",
}: {
  learningLanguage?: LearningLanguage;
}) {
  const {
    storage,
    activeCompany: company,
    activeProfile: profile,
    actions,
  } = useAppStorage();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const companyName = company?.companyName || company?.label || "";
  const isEnglish = learningLanguage === "en";
  const learningMatchesCompany =
    Boolean(storage.learning) &&
    storage.learning?.companyId === (company?.id ?? null) &&
    storage.learning?.language === learningLanguage;
  const learningStatusLabel = learningMatchesCompany
    ? isEnglish
      ? "英語学習済み"
      : "学習済み"
    : isEnglish
      ? "英語未学習"
      : "未学習";
  const learnButtonLabel = loading
    ? isEnglish
      ? "英語で学習中"
      : "学習中"
    : learningMatchesCompany
      ? isEnglish
        ? "英語で再学習"
        : "再学習"
      : isEnglish
        ? "英語で学習開始"
        : "学習開始";

  async function learn() {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/learn-interview-context", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-operation-id": crypto.randomUUID(),
          "x-request-id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          profile,
          company,
          selfInfo: profile?.careerSummary ?? "",
          desiredCourse: company?.targetRole ?? "",
          additionalNotes: company?.interviewFocus ?? "",
          learningLanguage,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "面接前学習に失敗しました");
      }
      const data = (await response.json()) as {
        brief: string;
        keyPoints: string[];
        caution: string | null;
      };
      actions.saveLearning({
        ...data,
        learnedAt: new Date().toISOString(),
        companyId: company?.id ?? null,
        language: learningLanguage,
      });
      setStatus(
        isEnglish
          ? "English learning is ready. Future English answers will use this memo."
          : "理解しました。以後の回答案にこの理解メモを使います。",
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "面接前学習に失敗しました",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Pre Interview
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {isEnglish ? "英語面接前に学習" : "面接前に学習"}
          </h2>
          {learningMatchesCompany || companyName ? (
            <p className="mt-2 text-sm font-medium leading-6 text-neutral-600">
              {learningMatchesCompany
                ? isEnglish
                  ? "この会社の英語理解メモを回答案に使います。"
                  : "この会社の理解メモを回答案に使います。"
                : isEnglish
                  ? "まだこの会社の英語面接前学習は完了していません。学習開始を押してください。"
                  : "まだこの会社の面接前学習は完了していません。学習開始を押してください。"}
            </p>
          ) : null}
        </div>
        <span
          className={[
            "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold",
            learningMatchesCompany
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-neutral-950/10 bg-neutral-100 text-neutral-600",
          ].join(" ")}
        >
          {learningMatchesCompany ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          ) : null}
          {learningStatusLabel}
        </span>
      </div>
      {learningMatchesCompany && companyName ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
            <Building2 className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {isEnglish ? "ENGLISH LLM学習済み" : "LLM学習済み"}
            </p>
            <p className="truncate text-base font-semibold tracking-tight text-emerald-950">
              {companyName}
            </p>
          </div>
        </div>
      ) : null}
      <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <button
          type="button"
          onClick={learn}
          disabled={loading}
          className="inline-flex min-h-16 items-center justify-center gap-3 rounded-3xl bg-[var(--accent)] px-6 text-base font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[#86868b]"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <Brain className="h-5 w-5" aria-hidden />
          )}
          {learnButtonLabel}
        </button>
        {storage.learning ? (
          <button
            type="button"
            onClick={actions.clearLearning}
            className="inline-flex min-h-16 items-center justify-center gap-2 rounded-3xl bg-[#f5f5f7] px-5 text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#e8e8ed]"
          >
            <X className="h-4 w-4" aria-hidden />
            解除
          </button>
        ) : null}
      </div>
      {status ? (
        <p className="mt-4 rounded-2xl bg-[#f5f5f7] px-4 py-3 text-sm font-medium text-[#6e6e73]">
          {status}
        </p>
      ) : null}
      {learningMatchesCompany && storage.learning ? (
        <div className="mt-4 rounded-2xl bg-[#f5f5f7] p-4 text-sm font-medium leading-7 text-[#424245]">
          <p>{storage.learning.brief}</p>
        </div>
      ) : null}
    </section>
  );
}
