"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Brain, Building2, CheckCircle2, Loader2, X } from "lucide-react";

import { requestInterviewLearning } from "@/lib/learning/client";
import {
  buildLearningProfileKey,
  describeStaleLearning,
  getLearningFreshness,
} from "@/lib/learning/freshness";
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
    ready,
    storage,
    activeCompany: company,
    activeProfiles: profiles,
    actions,
  } = useAppStorage();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const autoLearnKeyRef = useRef<string | null>(null);
  const companyName = company?.companyName || company?.label || "";
  const isEnglish = learningLanguage === "en";
  const freshness = getLearningFreshness({
    learning: storage.learning,
    company,
    profiles,
    language: learningLanguage,
  });
  const learningMatchesCompany = freshness === "current";
  const autoLearnKey = company
    ? [
        company.id,
        company.updatedAt,
        buildLearningProfileKey(profiles),
        learningLanguage,
      ].join("::")
    : null;
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

  const learn = useCallback(
    async (reason?: string) => {
      if (!company) {
        setStatus("会社スロットを作成・選択してから学習してください。");
        return;
      }
      setLoading(true);
      setStatus(reason ?? null);
      try {
        const learning = await requestInterviewLearning({
          profiles,
          company,
          language: learningLanguage,
        });
        actions.saveLearning(learning);
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
    },
    [actions, company, isEnglish, learningLanguage, profiles],
  );

  const learnRef = useRef(learn);
  useEffect(() => {
    learnRef.current = learn;
  }, [learn]);

  // 会社スロットの上書き・自分スロットの切り替えでメモが古くなったら、面接前に自動で作り直す。
  // 同じ組み合わせでは1回だけ（失敗しても繰り返さない）。再描画でタイマーを消さないよう、
  // 実行は learnRef 経由で行う。
  useEffect(() => {
    if (
      !ready ||
      loading ||
      !company ||
      profiles.length === 0 ||
      !autoLearnKey ||
      freshness === "current" ||
      autoLearnKeyRef.current === autoLearnKey
    ) {
      return;
    }
    autoLearnKeyRef.current = autoLearnKey;
    const reason = describeStaleLearning(freshness);
    window.setTimeout(() => {
      void learnRef.current(reason);
    }, 0);
  }, [autoLearnKey, company, freshness, loading, profiles.length, ready]);

  return (
    <section
      className={cn(
        "bg-white shadow-none ring-1 ring-black/[0.06]",
        compact ? "rounded-2xl p-3" : "rounded-[18px] p-3",
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
                : loading
                  ? isEnglish
                    ? "選択中の自分スロットと会社スロットから英語の理解メモを作っています。"
                    : "選択中の自分スロットと会社スロットから理解メモを作っています。"
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
          compact ? "mt-2" : "mt-2",
        )}
      >
        <button
          type="button"
          onClick={() => void learn()}
          disabled={loading}
          className={cn(
            "inline-flex items-center justify-center gap-3 bg-[var(--accent)] font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[#86868b]",
            compact
              ? "min-h-11 rounded-2xl px-4 text-sm"
              : "min-h-14 rounded-2xl px-5 text-base",
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
            onClick={() => {
              // 解除した組み合わせでは自動学習をやり直さない。
              autoLearnKeyRef.current = autoLearnKey;
              actions.clearLearning();
            }}
            className={cn(
              "inline-flex items-center justify-center gap-2 bg-[#f5f5f7] text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#e8e8ed]",
              compact
                ? "min-h-11 rounded-2xl px-4"
                : "min-h-14 rounded-2xl px-5",
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
