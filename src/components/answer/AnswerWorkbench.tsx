"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, RotateCw, Save, Send } from "lucide-react";

import { FormField, textareaClassName } from "@/components/forms/FormField";
import {
  buildQuickAnswerDraft,
  quickDraftDelayMs,
} from "@/lib/answer/quick-draft";
import {
  answerDraftSchema,
  questionClassificationSchema,
  validateAnswerLength,
  type AnswerDraft,
  type QuestionCategory,
  type QuestionClassification,
} from "@/lib/schemas/interview";
import { useAppStorage } from "@/lib/storage/use-app-storage";

type SsePayload =
  | { draft?: AnswerDraft; length?: { count: number; inRange: boolean } }
  | Partial<AnswerDraft>
  | { error?: string; message?: string };

type AnswerWorkbenchProps = {
  mode: "support" | "practice";
  initialQuestion?: string;
  autoSource?: "manual" | "remote-audio" | "practice";
  autoGenerate?: boolean;
  autoRunId?: string;
};

function mergeDraft(
  current: Partial<AnswerDraft>,
  next: Partial<AnswerDraft>,
): Partial<AnswerDraft> {
  return {
    ...current,
    ...next,
    talkingPoints: next.talkingPoints ?? current.talkingPoints,
    evidenceUsed: next.evidenceUsed ?? current.evidenceUsed,
    missingInformation: next.missingInformation ?? current.missingInformation,
  };
}

async function readSse(
  response: Response,
  onEvent: (event: string, data: SsePayload) => void,
) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("ストリームを読み取れませんでした");
  }
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const eventLine = frame
        .split("\n")
        .find((line) => line.startsWith("event: "));
      const dataLine = frame
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!eventLine || !dataLine) {
        continue;
      }
      onEvent(
        eventLine.slice("event: ".length),
        JSON.parse(dataLine.slice("data: ".length)) as SsePayload,
      );
    }
  }
}

export function AnswerWorkbench({
  mode,
  initialQuestion = "",
  autoSource = "manual",
  autoGenerate = false,
  autoRunId,
}: AnswerWorkbenchProps) {
  const { ready, storage, actions } = useAppStorage();
  const [question, setQuestion] = useState(initialQuestion);
  const [classification, setClassification] =
    useState<QuestionClassification | null>(null);
  const [draft, setDraft] = useState<Partial<AnswerDraft>>({});
  const [finalDraft, setFinalDraft] = useState<AnswerDraft | null>(null);
  const [category, setCategory] = useState<QuestionCategory>("other");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const lastAutoRunRef = useRef<string | null>(null);
  const quickDraftTimerRef = useRef<number | null>(null);
  const hasGeneratedContentRef = useRef(false);
  const generationRunRef = useRef(0);

  const activeProfile = storage.profiles[0] ?? null;
  const activeCompany = storage.companies[0] ?? null;
  const activeLearningBrief =
    storage.learning?.companyId === (activeCompany?.id ?? null)
      ? storage.learning.brief
      : "";
  const length = useMemo(
    () => validateAnswerLength(finalDraft?.answer ?? draft.answer ?? ""),
    [draft.answer, finalDraft?.answer],
  );

  const clearQuickDraftTimer = useCallback(() => {
    if (quickDraftTimerRef.current) {
      window.clearTimeout(quickDraftTimerRef.current);
      quickDraftTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearQuickDraftTimer();
  }, [clearQuickDraftTimer]);

  const classifyAndGenerate = useCallback(
    async (nextQuestion = question) => {
      if (!ready) {
        setWarning("保存済みのプロフィールと会社情報を読み込み中です。");
        return;
      }
      if (!nextQuestion.trim()) {
        setError("質問を入力してください");
        return;
      }

      abortController?.abort();
      clearQuickDraftTimer();
      const runId = generationRunRef.current + 1;
      generationRunRef.current = runId;
      hasGeneratedContentRef.current = false;
      const controller = new AbortController();
      setAbortController(controller);
      setLoading(true);
      setError(null);
      setWarning(null);
      setDraft({});
      setFinalDraft(null);
      quickDraftTimerRef.current = window.setTimeout(() => {
        quickDraftTimerRef.current = null;
        if (
          controller.signal.aborted ||
          generationRunRef.current !== runId ||
          hasGeneratedContentRef.current
        ) {
          return;
        }
        setDraft(
          buildQuickAnswerDraft({
            question: nextQuestion,
            category,
            profile: activeProfile,
            company: activeCompany,
            learningBrief: activeLearningBrief,
          }),
        );
        setWarning(
          "3秒ルール: 暫定回答です。LLM生成が完了すると自動で更新されます。",
        );
      }, quickDraftDelayMs);

      try {
        const classifyResponse = await fetch("/api/classify-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: nextQuestion,
            speaker: autoSource === "remote-audio" ? "remote" : "manual",
            source: autoSource,
          }),
          signal: controller.signal,
        });
        if (!classifyResponse.ok) {
          throw new Error("質問判定に失敗しました");
        }
        const classificationResult = questionClassificationSchema.parse(
          await classifyResponse.json(),
        );
        setClassification(classificationResult);
        setCategory(classificationResult.category);

        if (!classificationResult.isQuestion) {
          clearQuickDraftTimer();
          setDraft({});
          setFinalDraft(null);
          setWarning("質問または回答要求ではないため、回答案は生成しません。");
          return;
        }

        const answerResponse = await fetch("/api/generate-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: classificationResult.question || nextQuestion,
            category: classificationResult.category,
            profile: activeProfile,
            company: activeCompany,
            learningBrief: activeLearningBrief,
          }),
          signal: controller.signal,
        });
        if (!answerResponse.ok) {
          throw new Error("回答生成に失敗しました");
        }

        await readSse(answerResponse, (event, data) => {
          if (event === "error" && "error" in data) {
            setError(data.error ?? "回答生成に失敗しました");
          }
          if (event === "partial") {
            const partial = data as Partial<AnswerDraft>;
            if (
              partial.answer ||
              (partial.talkingPoints && partial.talkingPoints.length > 0)
            ) {
              hasGeneratedContentRef.current = true;
              clearQuickDraftTimer();
            }
            setDraft((current) => mergeDraft(current, partial));
          }
          if (event === "done" && "draft" in data && data.draft) {
            hasGeneratedContentRef.current = true;
            clearQuickDraftTimer();
            const parsed = answerDraftSchema.parse(data.draft);
            setFinalDraft(parsed);
            setDraft(parsed);
            if (!validateAnswerLength(parsed.answer).inRange) {
              setWarning(
                "回答案が250〜350文字の範囲外です。必要に応じて再生成してください。",
              );
            } else {
              setWarning(null);
            }
          }
        });
      } catch (caught) {
        clearQuickDraftTimer();
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setError(
          caught instanceof Error ? caught.message : "処理に失敗しました",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      abortController,
      activeCompany,
      activeLearningBrief,
      activeProfile,
      autoSource,
      category,
      clearQuickDraftTimer,
      question,
      ready,
    ],
  );

  useEffect(() => {
    if (!ready || !autoGenerate || !autoRunId || !initialQuestion.trim()) {
      return;
    }
    if (lastAutoRunRef.current === autoRunId) {
      return;
    }
    lastAutoRunRef.current = autoRunId;
    setQuestion(initialQuestion);
    void classifyAndGenerate(initialQuestion);
  }, [autoGenerate, autoRunId, classifyAndGenerate, initialQuestion, ready]);

  function saveHistory() {
    if (!finalDraft) {
      return;
    }
    actions.saveSession({
      id: crypto.randomUUID(),
      mode,
      question: finalDraft.question,
      answer: finalDraft.answer,
      talkingPoints: finalDraft.talkingPoints,
      evidenceUsed: finalDraft.evidenceUsed,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <section className="grid gap-4">
      <div className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
        <FormField label="手動質問入力">
          <textarea
            className={textareaClassName}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="例: これまでの経験について教えてください。"
          />
        </FormField>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => classifyAndGenerate()}
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0071e3] px-5 text-sm font-semibold text-white transition hover:bg-[#147ce5] disabled:cursor-not-allowed disabled:bg-[#86868b]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            回答案を作成
          </button>
          <button
            type="button"
            onClick={() =>
              classifyAndGenerate(finalDraft?.question ?? question)
            }
            disabled={loading || !question.trim()}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#f5f5f7] px-5 text-sm font-semibold transition hover:bg-[#e8e8ed] disabled:cursor-not-allowed disabled:text-[#86868b]"
          >
            <RotateCw className="h-4 w-4" aria-hidden />
            再生成
          </button>
          <button
            type="button"
            onClick={saveHistory}
            disabled={!finalDraft}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#f5f5f7] px-5 text-sm font-semibold transition hover:bg-[#e8e8ed] disabled:cursor-not-allowed disabled:text-[#86868b]"
          >
            <Save className="h-4 w-4" aria-hidden />
            履歴に保存
          </button>
          {loading ? (
            <button
              type="button"
              onClick={() => abortController?.abort()}
              className="h-11 rounded-full border border-red-300 bg-white px-5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              停止
            </button>
          ) : null}
        </div>
      </div>

      {classification ? (
        <div className="grid gap-3 rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06] md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Question
            </p>
            <p className="mt-2 text-sm font-medium">
              {classification.question || "なし"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Confidence
            </p>
            <p className="mt-2 text-sm font-medium">
              {Math.round(classification.confidence * 100)}%
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Category
            </p>
            <p className="mt-2 text-sm font-medium">{category}</p>
          </div>
        </div>
      ) : null}

      {error || warning ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error ?? warning}</span>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <section className="rounded-[30px] bg-[#1d1d1f] p-5 text-white shadow-sm">
          <h2 className="text-sm font-semibold">話すポイント3点</h2>
          <ol className="mt-3 grid gap-2">
            {(draft.talkingPoints ?? []).map((point, index) => (
              <li
                key={`${point}-${index}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm leading-6"
              >
                {index + 1}. {point}
              </li>
            ))}
          </ol>
          {(draft.talkingPoints ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-neutral-400">未生成です。</p>
          ) : null}
        </section>
        <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">250〜350文字の回答案</h2>
            <span className="rounded-full border border-neutral-950/10 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-600">
              {length.count}文字
            </span>
          </div>
          <p className="mt-4 min-h-36 whitespace-pre-wrap text-base font-medium leading-8 text-neutral-800">
            {draft.answer ?? "未生成です。"}
          </p>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
          <h2 className="text-sm font-semibold">使用した根拠情報</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {(draft.evidenceUsed ?? []).map((item) => (
              <li key={item} className="rounded-2xl bg-neutral-50 p-3">
                {item}
              </li>
            ))}
          </ul>
          {(draft.evidenceUsed ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">まだありません。</p>
          ) : null}
        </section>
        <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
          <h2 className="text-sm font-semibold">不足情報</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {(draft.missingInformation ?? []).map((item) => (
              <li key={item} className="rounded-2xl bg-neutral-50 p-3">
                {item}
              </li>
            ))}
          </ul>
          {(draft.missingInformation ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">
              不足情報はありません。
            </p>
          ) : null}
        </section>
      </div>
    </section>
  );
}
