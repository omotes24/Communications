"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  AlertTriangle,
  Brain,
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
  type AnswerModelMode,
  type QuestionCategory,
  type QuestionClassification,
} from "@/lib/schemas/interview";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import {
  estimateClassifyTokens,
  estimateGenerateAnswerTokens,
} from "@/lib/tokens/ai-estimates";
import { normalizeCommonTranscriptErrors } from "@/components/audio/transcript-auto-submit";

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

function answerModelLabel(mode: AnswerModelMode): string {
  return (
    answerModelOptions.find((option) => option.mode === mode)?.label ??
    answerModelOptions[0]?.label ??
    "標準"
  );
}

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Yell for You 1.1";

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
  transcriptPanel,
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
  const [fermiEstimationMode, setFermiEstimationMode] = useState(false);
  const [selfSlot, setSelfSlot] = useState("");
  const [manualNotice, setManualNotice] = useState<string | null>(null);
  const lastAutoRunRef = useRef<string | null>(null);
  const answerChatRef = useRef<HTMLElement | null>(null);
  const quickDraftTimersRef = useRef<Map<string, number>>(new Map());
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  const activeLearningBrief =
    storage.learning?.companyId &&
    activeCompanies.some((company) => company.id === storage.learning?.companyId)
      ? storage.learning.brief
      : "";
  const estimatedOperationTokens =
    question.trim().length > 0
      ? estimateClassifyTokens({
          transcript: question,
          speaker: autoSource === "remote-audio" ? "remote" : "manual",
          source: autoSource,
        }) +
        estimateGenerateAnswerTokens({
          question,
          category: "other",
          profile: activeProfile,
          company: activeCompany,
          profiles: activeProfiles,
          companies: activeCompanies,
          learningBrief: activeLearningBrief,
          conversationContext: buildConversationContext(turns),
          answerModelMode,
          fermiEstimationMode,
          selfSlot,
          answerLengthTarget:
            answerModelMode === "fermi" ? answerLengthTarget : undefined,
        })
      : null;

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
        updateTurn(turnId, {
          classification: classificationResult,
          category: classificationResult.category,
        });

        const answerQuestion =
          classificationResult.question || normalizedQuestion;
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
    <section className="grid gap-4">
      <div className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
        <FormField label="手動質問入力">
          <textarea
            className={textareaClassName}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleManualQuestionKeyDown}
            placeholder="例: これまでの経験について教えてください。"
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
            回答案を作成
          </button>
          {estimatedOperationTokens ? (
            <span className="text-xs font-semibold text-[#6e6e73]">
              予想消費 約{estimatedOperationTokens.toLocaleString()} tokens
              <span className="ml-1 font-medium">
                最終消費量は実際のAPI usageで確定します。
              </span>
            </span>
          ) : null}
          {manualNotice ? (
            <span className="text-sm font-medium text-amber-700">
              {manualNotice}
            </span>
          ) : null}
        </div>
      </div>

      <div
        className={
          transcriptPanel
            ? "grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start"
            : "grid gap-4"
        }
      >
        {transcriptPanel ? (
          <div className="xl:sticky xl:top-28">{transcriptPanel}</div>
        ) : null}

        <section
          ref={answerChatRef}
          className="rounded-[30px] bg-white p-4 shadow-sm ring-1 ring-black/[0.06] sm:p-5"
        >
        <div className="grid gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Answer Chat
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              回答チャット
            </h2>
          </div>
          <div className="grid w-full gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#f5f5f7] px-4 py-2 text-xs font-semibold text-[#6e6e73]">
                {turns.length}件
              </span>
              <div
                className="grid grid-cols-2 rounded-full bg-[#f5f5f7] p-1"
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
                          ? "bg-[#1d1d1f] text-white shadow-sm"
                          : "text-[#6e6e73] hover:bg-white hover:text-[#1d1d1f]",
                      ].join(" ")}
                    >
                      {option.mode === "fermi" ? (
                        <Brain className="h-3.5 w-3.5" aria-hidden />
                      ) : null}
                      <span>{option.label}</span>
                      <span className={selected ? "text-white/70" : ""}>
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
                    : "border-neutral-950/10 bg-white text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]",
                ].join(" ")}
              >
                <Brain className="h-3.5 w-3.5" aria-hidden />
                フェルミ推定
              </button>
            </div>

            {answerModelMode === "fermi" ? (
              <label className="grid gap-2 rounded-2xl bg-[#f5f5f7] p-3 text-xs font-semibold text-[#6e6e73]">
                <span className="flex items-center justify-between gap-2">
                  <span>回答尺</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[#1d1d1f]">
                    約{answerLengthTarget}文字
                  </span>
                </span>
                <input
                  type="range"
                  min={300}
                  max={900}
                  step={10}
                  value={answerLengthTarget}
                  onChange={(event) =>
                    setAnswerLengthTarget(Number(event.target.value))
                  }
                  className="h-2 w-full cursor-pointer accent-[var(--accent)]"
                />
                <span className="flex justify-between text-[11px] text-[#86868b]">
                  <span>短め</span>
                  <span>長め</span>
                </span>
              </label>
            ) : null}

            <label className="grid gap-1 text-xs font-semibold text-[#6e6e73]">
              <span>一時メモ</span>
              <textarea
                value={selfSlot}
                onChange={(event) => setSelfSlot(event.target.value)}
                rows={1}
                className="min-h-8 resize-y rounded-2xl border border-neutral-950/10 bg-white px-3 py-1.5 text-sm font-semibold leading-5 text-[#1d1d1f] outline-none transition placeholder:text-[#86868b] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-ring-strong)]"
                placeholder="例:具体例を多くする、論理的な思考をする"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 grid max-h-[760px] gap-4 overflow-y-auto pr-1">
          {turns.length === 0 ? (
            <div className="rounded-[24px] bg-[#f5f5f7] p-5 text-[13px] font-medium leading-6 text-[#6e6e73]">
              質問を検知すると、自動でここに回答案が追加されます。手動入力から追加することもできます。
            </div>
          ) : null}

          {visibleTurns.map((turn) => {
            const answer = turn.finalDraft?.answer ?? turn.draft.answer ?? "";
            const length = validateAnswerLength(
              answer,
              turn.answerLengthTarget ?? undefined,
            );

            return (
              <article key={turn.id} className="grid gap-3">
                <div className="flex justify-start">
                  <div className="max-w-[92%] rounded-[26px] bg-[#f5f5f7] px-5 py-4 text-[#1d1d1f]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {turn.loading ? (
                          <Loader2
                            className="h-4 w-4 animate-spin text-[var(--accent)]"
                            aria-hidden
                          />
                        ) : turn.finalDraft ? (
                          <CheckCircle2
                            className="h-4 w-4 text-emerald-600"
                            aria-hidden
                          />
                        ) : null}
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6e6e73]">
                          {appName}
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
                          {answerModelLabel(turn.answerModelMode)}
                        </span>
                        {turn.answerLengthTarget ? (
                          <span className="rounded-full bg-white px-3 py-1">
                            目標{turn.answerLengthTarget}文字
                          </span>
                        ) : null}
                        {turn.fermiEstimationMode ? (
                          <span className="rounded-full bg-white px-3 py-1">
                            フェルミ推定
                          </span>
                        ) : null}
                        {turn.profileSlotLabels.map((label) => (
                          <span
                            key={`profile-${turn.id}-${label}`}
                            className="rounded-full bg-white px-3 py-1"
                          >
                            自分: {label}
                          </span>
                        ))}
                        {turn.companySlotLabels.map((label) => (
                          <span
                            key={`company-${turn.id}-${label}`}
                            className="rounded-full bg-white px-3 py-1"
                          >
                            会社: {label}
                          </span>
                        ))}
                        {turn.selfSlotSnapshot ? (
                          <span className="rounded-full bg-white px-3 py-1">
                            メモあり
                          </span>
                        ) : null}
                        <span className="rounded-full bg-white px-3 py-1">
                          信頼度{" "}
                          {Math.round(turn.classification.confidence * 100)}%
                        </span>
                      </div>
                    ) : null}

                    {turn.error ? (
                      <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0"
                          aria-hidden
                        />
                        <span>{turn.error}</span>
                      </div>
                    ) : null}

                    <div className="mt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-[13px] font-semibold">回答案</h3>
                      </div>
                      <p className="mt-2 min-h-20 whitespace-pre-wrap text-[13px] font-semibold leading-6 text-[#1d1d1f]">
                        {answer ? (
                          renderEmphasizedText(answer)
                        ) : turn.loading ? (
                          "回答案を作成中です。"
                        ) : (
                          "未生成です。"
                        )}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          classifyAndGenerate(turn.question, turn.source)
                        }
                        disabled={turn.loading}
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-semibold transition hover:bg-[#e8e8ed] disabled:cursor-not-allowed disabled:text-[#86868b]"
                      >
                        <RotateCw className="h-4 w-4" aria-hidden />
                        再生成
                      </button>
                      <button
                        type="button"
                        onClick={() => saveHistory(turn)}
                        disabled={!turn.finalDraft || turn.saved}
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-semibold transition hover:bg-[#e8e8ed] disabled:cursor-not-allowed disabled:text-[#86868b]"
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
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="max-w-[88%] rounded-[26px] bg-[var(--accent)] px-5 py-4 text-white shadow-sm">
                    <div className="mb-2 flex flex-wrap items-center justify-end gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
                      <span>{sourceLabel(turn.source)}</span>
                      <span>{formatTime(turn.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-[12px] font-semibold leading-5">
                      {turn.question}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        </section>
      </div>
    </section>
  );
}
