"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCw,
  Save,
  Send,
  Square,
} from "lucide-react";

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
  type AnswerConversationTurn,
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

type AnswerSource = NonNullable<AnswerWorkbenchProps["autoSource"]>;

type AnswerTurn = {
  id: string;
  source: AnswerSource;
  question: string;
  classification: QuestionClassification | null;
  category: QuestionCategory;
  draft: Partial<AnswerDraft>;
  finalDraft: AnswerDraft | null;
  loading: boolean;
  error: string | null;
  warning: string | null;
  saved: boolean;
  createdAt: string;
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

function sourceLabel(source: AnswerSource): string {
  if (source === "remote-audio") {
    return "音声検知";
  }
  if (source === "practice") {
    return "練習";
  }
  return "手動";
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function compactForContext(text: string, maxLength: number): string {
  return Array.from(text.replace(/\s+/g, " ").trim())
    .slice(0, maxLength)
    .join("");
}

function buildConversationContext(
  turns: AnswerTurn[],
): AnswerConversationTurn[] {
  return turns
    .map((turn) => ({
      question: compactForContext(
        turn.finalDraft?.question ?? turn.question,
        220,
      ),
      answer: compactForContext(
        turn.finalDraft?.answer ?? turn.draft.answer ?? "",
        360,
      ),
    }))
    .filter((turn) => turn.question && turn.answer)
    .slice(-6);
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
  const [turns, setTurns] = useState<AnswerTurn[]>([]);
  const [manualNotice, setManualNotice] = useState<string | null>(null);
  const lastAutoRunRef = useRef<string | null>(null);
  const quickDraftTimersRef = useRef<Map<string, number>>(new Map());
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  const activeProfile = storage.profiles[0] ?? null;
  const activeCompany = storage.companies[0] ?? null;
  const activeLearningBrief =
    storage.learning?.companyId === (activeCompany?.id ?? null)
      ? storage.learning.brief
      : "";

  const updateTurn = useCallback(
    (
      turnId: string,
      updater: Partial<AnswerTurn> | ((turn: AnswerTurn) => AnswerTurn),
    ) => {
      setTurns((current) =>
        current.map((turn) => {
          if (turn.id !== turnId) {
            return turn;
          }
          return typeof updater === "function"
            ? updater(turn)
            : { ...turn, ...updater };
        }),
      );
    },
    [],
  );

  const clearQuickDraftTimer = useCallback((turnId: string) => {
    const timer = quickDraftTimersRef.current.get(turnId);
    if (timer) {
      window.clearTimeout(timer);
      quickDraftTimersRef.current.delete(turnId);
    }
  }, []);

  useEffect(() => {
    const quickDraftTimers = quickDraftTimersRef.current;
    const controllers = controllersRef.current;
    return () => {
      quickDraftTimers.forEach((timer) => window.clearTimeout(timer));
      quickDraftTimers.clear();
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, []);

  const classifyAndGenerate = useCallback(
    async (
      nextQuestion = question,
      source: AnswerSource = autoSource,
      requestedTurnId?: string,
    ) => {
      const normalizedQuestion = nextQuestion.trim();
      setManualNotice(null);

      if (!ready) {
        setManualNotice("保存済みのプロフィールと会社情報を読み込み中です。");
        return;
      }
      if (!normalizedQuestion) {
        setManualNotice("質問を入力してください。");
        return;
      }

      const turnId = requestedTurnId ?? crypto.randomUUID();
      const controller = new AbortController();
      controllersRef.current.set(turnId, controller);
      let hasGeneratedContent = false;
      let turnCategory: QuestionCategory = "other";
      const conversationContext = buildConversationContext(turns);

      setTurns((current) => [
        ...current,
        {
          id: turnId,
          source,
          question: normalizedQuestion,
          classification: null,
          category: turnCategory,
          draft: {},
          finalDraft: null,
          loading: true,
          error: null,
          warning: null,
          saved: false,
          createdAt: new Date().toISOString(),
        },
      ]);

      const quickDraftTimer = window.setTimeout(() => {
        quickDraftTimersRef.current.delete(turnId);
        if (controller.signal.aborted || hasGeneratedContent) {
          return;
        }
        updateTurn(turnId, (turn) => ({
          ...turn,
          draft: buildQuickAnswerDraft({
            question: normalizedQuestion,
            category: turnCategory,
            profile: activeProfile,
            company: activeCompany,
            learningBrief: activeLearningBrief,
            conversationContext,
          }),
          warning: null,
        }));
      }, quickDraftDelayMs);
      quickDraftTimersRef.current.set(turnId, quickDraftTimer);

      try {
        const classifyResponse = await fetch("/api/classify-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: normalizedQuestion,
            speaker: source === "remote-audio" ? "remote" : "manual",
            source,
          }),
          signal: controller.signal,
        });
        if (!classifyResponse.ok) {
          throw new Error("質問判定に失敗しました");
        }
        const classificationResult = questionClassificationSchema.parse(
          await classifyResponse.json(),
        );
        turnCategory = classificationResult.category;
        updateTurn(turnId, {
          classification: classificationResult,
          category: classificationResult.category,
        });

        const answerQuestion =
          classificationResult.question || normalizedQuestion;
        const answerResponse = await fetch("/api/generate-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: answerQuestion,
            category: classificationResult.category,
            profile: activeProfile,
            company: activeCompany,
            learningBrief: activeLearningBrief,
            conversationContext,
          }),
          signal: controller.signal,
        });
        if (!answerResponse.ok) {
          throw new Error("回答生成に失敗しました");
        }

        await readSse(answerResponse, (event, data) => {
          if (event === "error" && "error" in data) {
            updateTurn(turnId, {
              error: data.error ?? "回答生成に失敗しました",
            });
          }
          if (event === "partial") {
            const partial = data as Partial<AnswerDraft>;
            if (
              partial.answer ||
              (partial.talkingPoints && partial.talkingPoints.length > 0)
            ) {
              hasGeneratedContent = true;
              clearQuickDraftTimer(turnId);
            }
            updateTurn(turnId, (turn) => ({
              ...turn,
              draft: mergeDraft(turn.draft, partial),
            }));
          }
          if (event === "done" && "draft" in data && data.draft) {
            hasGeneratedContent = true;
            clearQuickDraftTimer(turnId);
            const parsed = answerDraftSchema.parse(data.draft);
            updateTurn(turnId, {
              finalDraft: parsed,
              draft: parsed,
              warning: null,
            });
          }
        });
      } catch (caught) {
        clearQuickDraftTimer(turnId);
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        updateTurn(turnId, {
          error:
            caught instanceof Error ? caught.message : "処理に失敗しました",
        });
      } finally {
        clearQuickDraftTimer(turnId);
        controllersRef.current.delete(turnId);
        updateTurn(turnId, { loading: false });
      }
    },
    [
      activeCompany,
      activeLearningBrief,
      activeProfile,
      autoSource,
      clearQuickDraftTimer,
      question,
      ready,
      turns,
      updateTurn,
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
    void classifyAndGenerate(initialQuestion, autoSource, autoRunId);
  }, [
    autoGenerate,
    autoRunId,
    autoSource,
    classifyAndGenerate,
    initialQuestion,
    ready,
  ]);

  function stopTurn(turnId: string) {
    controllersRef.current.get(turnId)?.abort();
    clearQuickDraftTimer(turnId);
    updateTurn(turnId, {
      loading: false,
      warning: "生成を停止しました。",
    });
  }

  function saveHistory(turn: AnswerTurn) {
    if (!turn.finalDraft) {
      return;
    }
    actions.saveSession({
      id: crypto.randomUUID(),
      mode,
      question: turn.finalDraft.question,
      answer: turn.finalDraft.answer,
      talkingPoints: turn.finalDraft.talkingPoints,
      evidenceUsed: turn.finalDraft.evidenceUsed,
      createdAt: new Date().toISOString(),
    });
    updateTurn(turn.id, { saved: true });
  }

  const visibleTurns = [...turns].reverse();

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
            onClick={() => classifyAndGenerate(question, "manual")}
            disabled={!question.trim()}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0071e3] px-5 text-sm font-semibold text-white transition hover:bg-[#147ce5] disabled:cursor-not-allowed disabled:bg-[#86868b]"
          >
            <Send className="h-4 w-4" aria-hidden />
            回答案を作成
          </button>
          {manualNotice ? (
            <span className="text-sm font-medium text-amber-700">
              {manualNotice}
            </span>
          ) : null}
        </div>
      </div>

      <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0071e3]">
              Answer Chat
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              回答チャット
            </h2>
          </div>
          <span className="rounded-full bg-[#f5f5f7] px-4 py-2 text-xs font-semibold text-[#6e6e73]">
            {turns.length}件
          </span>
        </div>

        <div className="mt-5 grid max-h-[760px] gap-4 overflow-y-auto pr-1">
          {turns.length === 0 ? (
            <div className="rounded-[24px] bg-[#f5f5f7] p-5 text-sm font-medium leading-7 text-[#6e6e73]">
              質問を検知すると、自動でここに回答案が追加されます。手動入力から追加することもできます。
            </div>
          ) : null}

          {visibleTurns.map((turn) => {
            const answer = turn.finalDraft?.answer ?? turn.draft.answer ?? "";
            const length = validateAnswerLength(answer);

            return (
              <article key={turn.id} className="grid gap-3">
                <div className="flex justify-end">
                  <div className="max-w-[88%] rounded-[26px] bg-[#0071e3] px-5 py-4 text-white shadow-sm">
                    <div className="mb-2 flex flex-wrap items-center justify-end gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
                      <span>{sourceLabel(turn.source)}</span>
                      <span>{formatTime(turn.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-[13px] font-semibold leading-6">
                      {turn.question}
                    </p>
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="max-w-[92%] rounded-[26px] bg-[#f5f5f7] px-5 py-4 text-[#1d1d1f]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {turn.loading ? (
                          <Loader2
                            className="h-4 w-4 animate-spin text-[#0071e3]"
                            aria-hidden
                          />
                        ) : turn.finalDraft ? (
                          <CheckCircle2
                            className="h-4 w-4 text-emerald-600"
                            aria-hidden
                          />
                        ) : null}
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6e6e73]">
                          QuestionTurbo
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#6e6e73]">
                        {length.count}文字
                      </span>
                    </div>

                    {turn.classification ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[#6e6e73]">
                        <span className="rounded-full bg-white px-3 py-1">
                          {turn.category}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1">
                          信頼度{" "}
                          {Math.round(turn.classification.confidence * 100)}%
                        </span>
                      </div>
                    ) : null}

                    {turn.error ? (
                      <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0"
                          aria-hidden
                        />
                        <span>{turn.error}</span>
                      </div>
                    ) : null}

                    <div className="mt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">回答案</h3>
                      </div>
                      <p className="mt-2 min-h-20 whitespace-pre-wrap text-base font-semibold leading-8 text-[#1d1d1f]">
                        {answer ||
                          (turn.loading
                            ? "回答案を作成中です。"
                            : "未生成です。")}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          classifyAndGenerate(turn.question, turn.source)
                        }
                        disabled={turn.loading}
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold transition hover:bg-[#e8e8ed] disabled:cursor-not-allowed disabled:text-[#86868b]"
                      >
                        <RotateCw className="h-4 w-4" aria-hidden />
                        再生成
                      </button>
                      <button
                        type="button"
                        onClick={() => saveHistory(turn)}
                        disabled={!turn.finalDraft || turn.saved}
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold transition hover:bg-[#e8e8ed] disabled:cursor-not-allowed disabled:text-[#86868b]"
                      >
                        <Save className="h-4 w-4" aria-hidden />
                        {turn.saved ? "保存済み" : "履歴に保存"}
                      </button>
                      {turn.loading ? (
                        <button
                          type="button"
                          onClick={() => stopTurn(turn.id)}
                          className="inline-flex h-10 items-center gap-2 rounded-full border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                        >
                          <Square className="h-4 w-4" aria-hidden />
                          停止
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
