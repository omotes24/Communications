"use client";

import { useState } from "react";
import { Brain, Building2, CheckCircle2, Loader2, X } from "lucide-react";

import { useAppStorage } from "@/lib/storage/use-app-storage";
import { cn } from "@/lib/utils";

type LearningLanguage = "ja" | "en";

export function PreInterviewLearningPanel({
  learningLanguage = "ja",
  compact = false,
}: {
  learningLanguage?: LearningLanguage;
  compact?: boolean;
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
    <section
      className={cn(
        "bg-white shadow-sm ring-1 ring-black/[0.06]",
        compact ? "rounded-[24px] p-3" : "rounded-[30px] p-5",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Pre Interview
          </p>
          <h2
            className={cn(
              "mt-1 font-semibold tracking-tight",
              compact ? "text-xl" : "text-2xl",
            )}
          >
            {isEnglish ? "英語面接前に学習" : "面接前に学習"}
          </h2>
          {!compact && (learningMatchesCompany || companyName) ? (
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
            compact
              ? "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold"
              : "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold",
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
      {learningMatchesCompany && companyName && !compact ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
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
      <div
        className={cn(
          "grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]",
          compact ? "mt-3" : "mt-5",
        )}
      >
        <button
          type="button"
          onClick={learn}
          disabled={loading}
          className={cn(
            "inline-flex items-center justify-center gap-3 bg-[var(--accent)] font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[#86868b]",
            compact
              ? "min-h-11 rounded-2xl px-4 text-sm"
              : "min-h-16 rounded-3xl px-6 text-base",
          )}
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
            className={cn(
              "inline-flex items-center justify-center gap-2 bg-[#f5f5f7] text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#e8e8ed]",
              compact
                ? "min-h-11 rounded-2xl px-4"
                : "min-h-16 rounded-3xl px-5",
            )}
          >
            <X className="h-4 w-4" aria-hidden />
            解除
          </button>
        ) : null}
      </div>
      {status ? (
        <p
          className={cn(
            "rounded-2xl bg-[#f5f5f7] text-sm font-medium text-[#6e6e73]",
            compact ? "mt-2 px-3 py-2" : "mt-4 px-4 py-3",
          )}
        >
          {status}
        </p>
      ) : null}
      {learningMatchesCompany && storage.learning ? (
        <div
          className={cn(
            "rounded-2xl bg-[#f5f5f7] text-sm font-medium text-[#424245]",
            compact
              ? "mt-2 max-h-16 overflow-y-auto p-3 leading-6"
              : "mt-4 p-4 leading-7",
          )}
        >
          <p>{storage.learning.brief}</p>
        </div>
      ) : null}
    </section>
  );
}
