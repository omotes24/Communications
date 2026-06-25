"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  AlertTriangle,
  Brain,
  RotateCw,
  Save,
  Send,
  Square,
  Type,
} from "lucide-react";

import { FormField, textareaClassName } from "@/components/forms/FormField";
import {
  buildQuickAnswerDraft,
  quickDraftDelayMs,
} from "@/lib/answer/quick-draft";
import {
  answerDraftSchema,
  questionClassificationSchema,
  type AnswerDraft,
  type AnswerLanguage,
  type AnswerConversationTurn,
  type AnswerModelMode,
  type QuestionCategory,
  type QuestionClassification,
} from "@/lib/schemas/interview";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import { normalizeCommonTranscriptErrors } from "@/components/audio/transcript-auto-submit";
import { cn } from "@/lib/utils";

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
  transcriptPanel?: ReactNode;
  answerLanguage?: AnswerLanguage;
  tone?: "light" | "dark";
  compact?: boolean;
};

type AnswerSource = NonNullable<AnswerWorkbenchProps["autoSource"]>;

const publicAiProvider =
  process.env.NEXT_PUBLIC_AI_PROVIDER === "groq" ? "groq" : "openai";

const answerModelOptions: Array<{
  mode: AnswerModelMode;
  label: string;
  description: string;
}> =
  publicAiProvider === "groq"
    ? [
        { mode: "standard", label: "Groq 20B", description: "高速" },
        { mode: "fermi", label: "Groq 120B", description: "高精度" },
      ]
    : [
        { mode: "standard", label: "5.4 mini", description: "高速" },
        { mode: "fermi", label: "5.5", description: "高精度" },
      ];

type AnswerTurn = {
  id: string;
  source: AnswerSource;
  answerModelMode: AnswerModelMode;
  answerLengthTarget: number | null;
  fermiEstimationMode: boolean;
  profileSlotLabels: string[];
  companySlotLabels: string[];
  selfSlotSnapshot: string;
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

function renderEmphasizedText(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${part}-${index}`} className="font-extrabold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
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
  transcriptPanel,
  answerLanguage = "ja",
  tone = "light",
  compact = false,
}: AnswerWorkbenchProps) {
  const {
    ready,
    storage,
    activeCompany,
    activeCompanies,
    activeProfile,
    activeProfiles,
    actions,
  } = useAppStorage();
  const [question, setQuestion] = useState(initialQuestion);
  const [turns, setTurns] = useState<AnswerTurn[]>([]);
  const [answerModelMode, setAnswerModelMode] =
    useState<AnswerModelMode>("standard");
  const [answerLengthTarget, setAnswerLengthTarget] = useState(450);
  const [chatFontSize, setChatFontSize] = useState(13);
  const [fermiEstimationMode, setFermiEstimationMode] = useState(false);
  const [selfSlot, setSelfSlot] = useState("");
  const [manualNotice, setManualNotice] = useState<string | null>(null);
  const lastAutoRunRef = useRef<string | null>(null);
  const answerChatRef = useRef<HTMLElement | null>(null);
  const quickDraftTimersRef = useRef<Map<string, number>>(new Map());
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const isDark = tone === "dark";
  const questionFontSize = Math.max(12, chatFontSize - 1);
  const answerLineHeight = `${Math.round(chatFontSize * 1.9)}px`;
  const questionLineHeight = `${Math.round(questionFontSize * 1.8)}px`;

  const activeLearningBrief =
    storage.learning?.companyId &&
    storage.learning?.language === answerLanguage &&
    activeCompanies.some(
      (company) => company.id === storage.learning?.companyId,
    )
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
      const normalizedQuestion =
        normalizeCommonTranscriptErrors(nextQuestion).trim();
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
      const selfSlotSnapshot = selfSlot.trim();
      const profileSlotLabels = activeProfiles.map((profile) => profile.label);
      const companySlotLabels = activeCompanies.map(
        (company) => company.companyName || company.label,
      );
      const lengthTarget =
        answerModelMode === "fermi" ? answerLengthTarget : null;
      const fermiModeSnapshot = fermiEstimationMode;
      const operationId = crypto.randomUUID();

      setTurns((current) => [
        ...current,
        {
          id: turnId,
          source,
          answerModelMode,
          answerLengthTarget: lengthTarget,
          fermiEstimationMode: fermiModeSnapshot,
          profileSlotLabels,
          companySlotLabels,
          selfSlotSnapshot,
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
        if (answerLanguage === "ja") {
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
        }
      }, quickDraftDelayMs);
      quickDraftTimersRef.current.set(turnId, quickDraftTimer);

      try {
        const classifyResponse = await fetch("/api/classify-question", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-operation-id": operationId,
            "x-request-id": crypto.randomUUID(),
          },
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
        const answerQuestion =
          classificationResult.question || normalizedQuestion;
        updateTurn(turnId, {
          classification: classificationResult,
          category: classificationResult.category,
          question:
            answerLanguage === "en" ? answerQuestion : normalizedQuestion,
        });

        const answerResponse = await fetch("/api/generate-answer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-operation-id": operationId,
            "x-request-id": crypto.randomUUID(),
          },
          body: JSON.stringify({
            question: answerQuestion,
            category: classificationResult.category,
            profile: activeProfile,
            company: activeCompany,
            profiles: activeProfiles,
            companies: activeCompanies,
            learningBrief: activeLearningBrief,
            conversationContext,
            answerModelMode,
            answerLanguage,
            fermiEstimationMode: fermiModeSnapshot,
            selfSlot: selfSlotSnapshot,
            answerLengthTarget: lengthTarget ?? undefined,
          }),
          signal: controller.signal,
        });
        if (!answerResponse.ok) {
          const data = (await answerResponse.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? "回答生成に失敗しました");
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
      activeCompanies,
      activeLearningBrief,
      activeProfile,
      activeProfiles,
      answerLanguage,
      answerLengthTarget,
      answerModelMode,
      autoSource,
      clearQuickDraftTimer,
      fermiEstimationMode,
      question,
      ready,
      selfSlot,
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

  function submitManualQuestion() {
    const submittedQuestion = question.trim();
    if (ready && submittedQuestion) {
      setQuestion("");
    }
    void classifyAndGenerate(submittedQuestion, "manual");
    if (submittedQuestion) {
      window.requestAnimationFrame(() => {
        answerChatRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }

  function handleManualQuestionKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    if (event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    if (question.trim()) {
      submitManualQuestion();
    }
  }

  const visibleTurns = [...turns].reverse();

  return (
    <section className={cn("grid", compact ? "gap-2" : "gap-4")}>
      <section
        ref={answerChatRef}
        className={cn(
          compact
            ? "rounded-[24px] p-3 shadow-sm ring-1"
            : "rounded-[30px] p-4 shadow-sm ring-1 sm:p-5",
          isDark
            ? "bg-neutral-950 text-white ring-white/10"
            : "bg-white ring-black/[0.06]",
        )}
      >
        <div className={cn("grid", compact ? "gap-2" : "gap-3")}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Answer Chat
            </p>
            <h2
              className={cn(
                "mt-1 font-semibold tracking-tight",
                compact ? "text-lg" : "text-xl",
              )}
            >
              {answerLanguage === "en" ? "English Answer Chat" : "回答チャット"}
            </h2>
          </div>
          <div className="grid w-full gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-semibold",
                  isDark
                    ? "bg-white/10 text-white/70"
                    : "bg-[#f5f5f7] text-[#6e6e73]",
                )}
              >
                {turns.length}件
              </span>
              <div
                className={cn(
                  "grid grid-cols-2 rounded-full p-1",
                  isDark ? "bg-white/10" : "bg-[#f5f5f7]",
                )}
                aria-label="回答モデル"
                role="group"
              >
                {answerModelOptions.map((option) => {
                  const selected = answerModelMode === option.mode;
                  return (
                    <button
                      key={option.mode}
                      type="button"
                      onClick={() => setAnswerModelMode(option.mode)}
                      className={[
                        "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition",
                        selected
                          ? isDark
                            ? "bg-white text-neutral-950 shadow-sm"
                            : "bg-[var(--accent)] text-white shadow-sm"
                          : isDark
                            ? "text-white/60 hover:bg-white/10 hover:text-white"
                            : "text-[#6e6e73] hover:bg-white hover:text-[#1d1d1f]",
                      ].join(" ")}
                    >
                      {option.mode === "fermi" ? (
                        <Brain className="h-3.5 w-3.5" aria-hidden />
                      ) : null}
                      <span>{option.label}</span>
                      <span
                        className={
                          selected
                            ? isDark
                              ? "text-neutral-500"
                              : "text-white/70"
                            : ""
                        }
                      >
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  setFermiEstimationMode((current) => !current);
                  setAnswerModelMode("fermi");
                  setAnswerLengthTarget((current) => Math.max(current, 600));
                }}
                aria-pressed={fermiEstimationMode}
                className={[
                  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition",
                  fermiEstimationMode
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : isDark
                      ? "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                      : "border-neutral-950/10 bg-white text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]",
                ].join(" ")}
              >
                <Brain className="h-3.5 w-3.5" aria-hidden />
                フェルミ推定
              </button>
              <label
                className={cn(
                  "inline-flex min-h-9 min-w-[220px] flex-1 items-center gap-2 rounded-full border px-3 text-xs font-semibold sm:max-w-[360px]",
                  isDark
                    ? "border-white/10 bg-neutral-900 text-white/70"
                    : "border-neutral-950/10 bg-white text-[#6e6e73]",
                )}
              >
                <span className="shrink-0">
                  {answerLanguage === "en" ? "Temporary note" : "一時メモ"}
                </span>
                <input
                  type="text"
                  value={selfSlot}
                  onChange={(event) => setSelfSlot(event.target.value)}
                  className={cn(
                    "min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#1d1d1f] outline-none placeholder:text-[#86868b]",
                    isDark
                      ? "text-white placeholder:text-white/40"
                      : "text-[#1d1d1f]",
                  )}
                  placeholder={
                    answerLanguage === "en"
                      ? "concise, confident tone"
                      : "具体例多め、論理的に"
                  }
                />
              </label>
              <label
                className={cn(
                  "inline-flex min-h-9 min-w-[190px] flex-1 items-center gap-2 rounded-full px-3 text-xs font-semibold sm:max-w-[260px]",
                  isDark
                    ? "bg-white/10 text-white/70"
                    : "bg-[#f5f5f7] text-[#6e6e73]",
                )}
              >
                <Type className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="shrink-0">文字</span>
                <input
                  type="range"
                  min={12}
                  max={16}
                  step={1}
                  value={chatFontSize}
                  onChange={(event) =>
                    setChatFontSize(Number(event.target.value))
                  }
                  className="h-2 min-w-0 flex-1 cursor-pointer accent-[var(--accent)]"
                />
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5",
                    isDark
                      ? "bg-neutral-950 text-white"
                      : "bg-white text-[#1d1d1f]",
                  )}
                >
                  {chatFontSize}
                </span>
              </label>
              {answerModelMode === "fermi" ? (
                <label
                  className={cn(
                    "inline-flex min-h-9 w-full items-center gap-2 rounded-full px-3 text-xs font-semibold sm:w-[300px]",
                    isDark
                      ? "bg-white/10 text-white/70"
                      : "bg-[#f5f5f7] text-[#6e6e73]",
                  )}
                >
                  <span className="shrink-0">回答尺</span>
                  <input
                    type="range"
                    min={300}
                    max={900}
                    step={10}
                    value={answerLengthTarget}
                    onChange={(event) =>
                      setAnswerLengthTarget(Number(event.target.value))
                    }
                    className="h-2 min-w-0 flex-1 cursor-pointer accent-[var(--accent)]"
                  />
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5",
                      isDark
                        ? "bg-neutral-950 text-white"
                        : "bg-white text-[#1d1d1f]",
                    )}
                  >
                    約{answerLengthTarget}
                  </span>
                </label>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "grid overflow-y-auto pr-1",
            compact
              ? "mt-3 max-h-[300px] gap-3 sm:max-h-[340px]"
              : "mt-5 max-h-[430px] gap-4 sm:max-h-[520px]",
          )}
        >
          {turns.length === 0 ? (
            <div
              className={cn(
                "rounded-[24px] p-5 text-[13px] font-medium leading-6",
                isDark
                  ? "bg-white/10 text-white/60"
                  : "bg-[#f5f5f7] text-[#6e6e73]",
              )}
            >
              {answerLanguage === "en"
                ? "When a question is detected, the Japanese translation and English answer will appear here. You can also enter a question manually."
                : "質問を検知すると、自動でここに回答案が追加されます。手動入力から追加することもできます。"}
            </div>
          ) : null}

          {visibleTurns.map((turn) => {
            const answer = turn.finalDraft?.answer ?? turn.draft.answer ?? "";

            return (
              <article key={turn.id} className="grid gap-3">
                <div className="flex justify-start">
                  <div
                    className={cn(
                      "max-w-[96%] rounded-[26px] px-5 py-4",
                      isDark
                        ? "bg-white/10 text-white"
                        : "bg-[#f5f5f7] text-[#1d1d1f]",
                    )}
                  >
                    {turn.error ? (
                      <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0"
                          aria-hidden
                        />
                        <span>{turn.error}</span>
                      </div>
                    ) : null}

                    <div className={turn.error ? "mt-3" : undefined}>
                      <p
                        className={cn(
                          "min-h-20 whitespace-pre-wrap font-semibold",
                          isDark ? "text-white" : "text-[#1d1d1f]",
                        )}
                        style={{
                          fontSize: `${chatFontSize}px`,
                          lineHeight: answerLineHeight,
                        }}
                      >
                        {answer
                          ? renderEmphasizedText(answer)
                          : turn.loading
                            ? "回答案を作成中です。"
                            : "未生成です。"}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            classifyAndGenerate(turn.question, turn.source)
                          }
                          disabled={turn.loading}
                          className={cn(
                            "inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold transition disabled:cursor-not-allowed disabled:text-[#86868b]",
                            isDark
                              ? "bg-neutral-950 text-white hover:bg-neutral-800"
                              : "bg-white hover:bg-[#e8e8ed]",
                          )}
                        >
                          <RotateCw className="h-4 w-4" aria-hidden />
                          再生成
                        </button>
                        <button
                          type="button"
                          onClick={() => saveHistory(turn)}
                          disabled={!turn.finalDraft || turn.saved}
                          className={cn(
                            "inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold transition disabled:cursor-not-allowed disabled:text-[#86868b]",
                            isDark
                              ? "bg-neutral-950 text-white hover:bg-neutral-800"
                              : "bg-white hover:bg-[#e8e8ed]",
                          )}
                        >
                          <Save className="h-4 w-4" aria-hidden />
                          {turn.saved ? "保存済み" : "履歴に保存"}
                        </button>
                        {turn.loading ? (
                          <button
                            type="button"
                            onClick={() => stopTurn(turn.id)}
                            className="inline-flex h-10 items-center gap-2 rounded-full border border-red-300 bg-white px-4 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                          >
                            <Square className="h-4 w-4" aria-hidden />
                            停止
                          </button>
                        ) : null}
                      </div>
                      <div className="flex min-w-[220px] flex-1 justify-end">
                        <div
                          className={cn(
                            "max-w-full rounded-[24px] px-4 py-3 text-white shadow-sm sm:max-w-[62%]",
                            isDark ? "bg-violet-600" : "bg-[var(--accent)]",
                          )}
                        >
                          <p
                            className="whitespace-pre-wrap font-semibold"
                            style={{
                              fontSize: `${questionFontSize}px`,
                              lineHeight: questionLineHeight,
                            }}
                          >
                            {turn.question}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {transcriptPanel ? <div>{transcriptPanel}</div> : null}

      <div
        className={cn(
          compact
            ? "rounded-[24px] p-3 shadow-sm ring-1"
            : "rounded-[30px] p-5 shadow-sm ring-1",
          isDark
            ? "bg-neutral-950 text-white ring-white/10"
            : "bg-white ring-black/[0.06]",
        )}
      >
        <FormField
          label={
            answerLanguage === "en" ? "Manual question input" : "手動質問入力"
          }
          className={isDark ? "text-white" : undefined}
        >
          <textarea
            className={
              isDark
                ? cn(
                    "rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm leading-7 text-white outline-none shadow-sm transition placeholder:text-white/40 focus:border-violet-400 focus:ring-4 focus:ring-violet-400/20",
                    compact ? "min-h-20" : "min-h-32",
                  )
                : compact
                  ? "min-h-20 rounded-2xl border border-black/[0.08] bg-white px-4 py-3 text-sm leading-7 text-[#1d1d1f] outline-none shadow-sm transition placeholder:text-[#86868b] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-ring)]"
                  : textareaClassName
            }
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleManualQuestionKeyDown}
            placeholder={
              answerLanguage === "en"
                ? "例: What experience do you have leading a team?"
                : "例: これまでの経験について教えてください。"
            }
          />
        </FormField>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={submitManualQuestion}
            disabled={!question.trim()}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[#86868b]"
          >
            <Send className="h-4 w-4" aria-hidden />
            {answerLanguage === "en" ? "Create answer" : "回答案を作成"}
          </button>
          {manualNotice ? (
            <span className="text-sm font-medium text-amber-500">
              {manualNotice}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
