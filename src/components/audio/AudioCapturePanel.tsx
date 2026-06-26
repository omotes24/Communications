"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, MonitorUp, Square } from "lucide-react";

import {
  useRealtimeTranscription,
  type TranscriptItem,
} from "@/components/audio/use-realtime-transcription";
import type { RealtimeTranscriptionDelay } from "@/lib/openai/transcription-delay";
import {
  formatTranscriptItemsForReading,
  mergeTranscriptItemsForReading,
} from "@/components/audio/transcript-items";
import {
  createTranscriptSubmitKey,
  createTranscriptSubmitFingerprint,
  extractLikelyInterviewQuestion,
  findRecentTranscriptSubmitFingerprint,
  isSubmittableTranscript,
  looksCompleteInterviewQuestion,
  looksLikeInterviewQuestion,
  normalizeTranscriptForSubmit,
  remoteTranscriptDuplicateWindowMs,
  remoteTranscriptMinimumAutoSubmitGapMs,
  remoteTranscriptQuestionCueDelayMs,
} from "@/components/audio/transcript-auto-submit";
import {
  requestDisplayAudio,
  requestMicrophone,
  stopMediaStream,
} from "@/lib/audio/media";
import { cn } from "@/lib/utils";

const transcriptionDelayOptions: Array<{
  value: RealtimeTranscriptionDelay;
  label: string;
  description: string;
}> = [
  { value: "high", label: "高精度", description: "標準" },
  { value: "xhigh", label: "最高精度", description: "遅め" },
];

type AudioCapturePanelProps = {
  onRemoteTranscript?: (text: string) => void;
  autoSubmitRemoteFinal?: boolean;
  questionLocked?: boolean;
  questionCycle?: number;
  onTranscriptItemsChange?: (items: TranscriptItem[]) => void;
  showTranscript?: boolean;
  tone?: "light" | "dark";
  compact?: boolean;
};

export function AudioCapturePanel({
  onRemoteTranscript,
  autoSubmitRemoteFinal = false,
  questionLocked = false,
  questionCycle = 0,
  onTranscriptItemsChange,
  showTranscript = true,
  tone = "light",
  compact = false,
}: AudioCapturePanelProps) {
  const transcription = useRealtimeTranscription();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [activeSource, setActiveSource] = useState<"remote" | "local" | null>(
    null,
  );
  const [transcriptionDelay, setTranscriptionDelay] =
    useState<RealtimeTranscriptionDelay>("high");
  const [error, setError] = useState<string | null>(null);
  const isDark = tone === "dark";
  const submittedIdsRef = useRef<Set<string>>(new Set());
  const submittedFingerprintsRef = useRef<Map<string, number>>(new Map());
  const pendingQuestionCueSubmitTimerRef = useRef<number | null>(null);
  const lastAutoSubmittedAtRef = useRef(0);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const transcriptStickToBottomRef = useRef(true);
  const latestRemoteCandidateRef = useRef<{ id: string; text: string } | null>(
    null,
  );
  const latestRemoteTranscriptTextRef = useRef("");
  const resumeBaselineTextRef = useRef("");

  const isConnecting = transcription.status === "connecting";
  const isRecording = transcription.status === "live";
  const isAudioBusy = isConnecting || isRecording;
  const statusLabel = isRecording
    ? "録音中"
    : isConnecting
      ? "接続中"
      : transcription.status === "error"
        ? "エラー"
        : "待機中";
  const sourceLabel =
    activeSource === "remote"
      ? "タブ・画面音声"
      : activeSource === "local"
        ? "マイク"
        : "未選択";
  const transcriptItemsForReading = useMemo(
    () => mergeTranscriptItemsForReading(transcription.items),
    [transcription.items],
  );
  const transcriptTextForDisplay = useMemo(
    () => formatTranscriptItemsForReading(transcription.items),
    [transcription.items],
  );

  useEffect(() => {
    const scrollContainer = transcriptScrollRef.current;
    if (scrollContainer && transcriptStickToBottomRef.current) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [transcriptTextForDisplay]);

  function updateTranscriptScrollMode() {
    const scrollContainer = transcriptScrollRef.current;
    if (!scrollContainer) {
      return;
    }
    const distanceFromBottom =
      scrollContainer.scrollHeight -
      scrollContainer.scrollTop -
      scrollContainer.clientHeight;
    transcriptStickToBottomRef.current = distanceFromBottom < 32;
  }

  const clearPendingRemoteSubmitTimers = useCallback(() => {
    if (pendingQuestionCueSubmitTimerRef.current) {
      window.clearTimeout(pendingQuestionCueSubmitTimerRef.current);
      pendingQuestionCueSubmitTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const latestRemoteItem = transcriptItemsForReading
      .slice()
      .reverse()
      .find((item) => item.source === "remote" && item.text.trim());
    latestRemoteTranscriptTextRef.current = latestRemoteItem
      ? normalizeTranscriptForSubmit(latestRemoteItem.text)
      : "";
  }, [transcriptItemsForReading]);

  useEffect(() => {
    onTranscriptItemsChange?.(transcription.items);
  }, [onTranscriptItemsChange, transcription.items]);

  const getTextAfterResumeBaseline = useCallback((text: string): string => {
    const normalizedText = normalizeTranscriptForSubmit(text);
    const baseline = resumeBaselineTextRef.current;
    if (baseline && normalizedText.startsWith(baseline)) {
      return normalizeTranscriptForSubmit(
        normalizedText.slice(baseline.length),
      );
    }
    return normalizedText;
  }, []);

  useEffect(() => {
    clearPendingRemoteSubmitTimers();
    submittedIdsRef.current.clear();
    latestRemoteCandidateRef.current = null;
    lastAutoSubmittedAtRef.current = questionCycle > 0 ? Date.now() : 0;
    resumeBaselineTextRef.current = latestRemoteTranscriptTextRef.current;
  }, [clearPendingRemoteSubmitTimers, questionCycle]);

  const submitRemoteTranscript = useCallback(
    (id: string, text: string, enforceAutoSubmitGap: boolean) => {
      if (!onRemoteTranscript || questionLocked) {
        return;
      }
      const normalizedText = normalizeTranscriptForSubmit(text);
      if (!isSubmittableTranscript(normalizedText)) {
        return;
      }
      const now = Date.now();
      const fingerprint = createTranscriptSubmitFingerprint(normalizedText);
      if (
        findRecentTranscriptSubmitFingerprint(
          submittedFingerprintsRef.current,
          fingerprint,
          now,
          remoteTranscriptDuplicateWindowMs,
        )
      ) {
        return;
      }
      const submitKey = createTranscriptSubmitKey(id, normalizedText);
      if (submittedIdsRef.current.has(submitKey)) {
        return;
      }
      if (
        enforceAutoSubmitGap &&
        Date.now() - lastAutoSubmittedAtRef.current <
          remoteTranscriptMinimumAutoSubmitGapMs
      ) {
        return;
      }
      submittedIdsRef.current.add(submitKey);
      submittedFingerprintsRef.current.set(fingerprint, now);
      lastAutoSubmittedAtRef.current = now;
      resumeBaselineTextRef.current =
        latestRemoteTranscriptTextRef.current || normalizedText;
      onRemoteTranscript(normalizedText);
    },
    [onRemoteTranscript, questionLocked],
  );

  useEffect(() => {
    if (!autoSubmitRemoteFinal || !onRemoteTranscript || questionLocked) {
      return;
    }

    const latestRemoteItem = transcriptItemsForReading
      .slice()
      .reverse()
      .find(
        (item) =>
          item.source === "remote" && isSubmittableTranscript(item.text),
      );
    if (!latestRemoteItem) {
      return;
    }

    const normalizedText = extractLikelyInterviewQuestion(
      getTextAfterResumeBaseline(latestRemoteItem.text),
    );
    if (!isSubmittableTranscript(normalizedText)) {
      return;
    }
    const isCompleteQuestion = looksCompleteInterviewQuestion(normalizedText);
    if (
      !looksLikeInterviewQuestion(normalizedText) ||
      (!latestRemoteItem.final && !isCompleteQuestion)
    ) {
      return;
    }
    latestRemoteCandidateRef.current = {
      id: latestRemoteItem.id,
      text: normalizedText,
    };

    if (latestRemoteItem.final) {
      if (!isCompleteQuestion) {
        return;
      }
      clearPendingRemoteSubmitTimers();
      submitRemoteTranscript(latestRemoteItem.id, normalizedText, false);
      return;
    }

    if (
      isCompleteQuestion &&
      !pendingQuestionCueSubmitTimerRef.current
    ) {
      const remainingGapMs =
        remoteTranscriptMinimumAutoSubmitGapMs -
        (Date.now() - lastAutoSubmittedAtRef.current);
      const submitDelayMs = Math.max(
        remoteTranscriptQuestionCueDelayMs,
        remainingGapMs,
      );
      pendingQuestionCueSubmitTimerRef.current = window.setTimeout(() => {
        pendingQuestionCueSubmitTimerRef.current = null;
        const candidate = latestRemoteCandidateRef.current;
        if (candidate) {
          submitRemoteTranscript(candidate.id, candidate.text, true);
        }
      }, submitDelayMs);
    }
  }, [
    autoSubmitRemoteFinal,
    clearPendingRemoteSubmitTimers,
    getTextAfterResumeBaseline,
    onRemoteTranscript,
    questionLocked,
    submitRemoteTranscript,
    transcriptItemsForReading,
  ]);

  useEffect(() => {
    return () => {
      clearPendingRemoteSubmitTimers();
    };
  }, [clearPendingRemoteSubmitTimers]);

  async function startMic() {
    try {
      setError(null);
      const stream = await requestMicrophone();
      setLocalStream(stream);
      setActiveSource("local");
      await transcription.start(stream, "local", { transcriptionDelay });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "マイク取得エラー");
    }
  }

  async function startRemoteAudio() {
    try {
      setError(null);
      clearPendingRemoteSubmitTimers();
      const stream = await requestDisplayAudio();
      setRemoteStream(stream);
      setActiveSource("remote");
      await transcription.start(stream, "remote", { transcriptionDelay });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "画面音声取得エラー");
    }
  }

  function stopAll() {
    clearPendingRemoteSubmitTimers();
    transcription.stop();
    stopMediaStream(localStream);
    stopMediaStream(remoteStream);
    setLocalStream(null);
    setRemoteStream(null);
    setActiveSource(null);
  }

  return (
    <section
      className={cn(
        compact
          ? "rounded-[24px] p-3 shadow-sm ring-1 transition"
          : "rounded-[30px] p-5 shadow-sm ring-1 transition",
        isDark
          ? "bg-neutral-950 text-white ring-white/10"
          : "bg-white text-[#1d1d1f] ring-black/[0.06]",
        isRecording ? "shadow-red-500/10 ring-red-400/60" : null,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Audio
          </p>
          <h2
            className={cn(
              "mt-1 font-semibold tracking-tight",
              compact ? "text-xl" : "text-2xl",
            )}
          >
            音声入力
          </h2>
          {!compact ? (
            <p
              className={cn(
                "mt-2 text-sm font-medium leading-6",
                isDark ? "text-white/60" : "text-neutral-600",
              )}
            >
              <span className="underline underline-offset-2">Chrome/Edge</span>
              でZoomやMeetのブラウザタブを選び、タブ音声を共有すると相手の質問を文字起こしできます。
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold",
            isRecording
              ? "border-red-300 bg-red-50 text-red-700"
              : isConnecting
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : transcription.status === "error"
                  ? "border-red-300 bg-red-50 text-red-700"
                  : isDark
                    ? "border-white/10 bg-white/10 text-white/70"
                    : "border-neutral-950/10 bg-neutral-50 text-neutral-600",
          )}
        >
          {isRecording ? (
            <span
              className="h-2.5 w-2.5 rounded-full bg-red-600 motion-safe:animate-pulse"
              aria-hidden
            />
          ) : null}
          {statusLabel}
        </span>
      </div>

      <div
        className={cn(
          compact
            ? "mt-3 rounded-[20px] p-3 transition"
            : "mt-5 rounded-[24px] p-4 transition",
          isRecording
            ? isDark
              ? "bg-red-950/40 ring-1 ring-red-500/35"
              : "bg-red-50 ring-1 ring-red-200"
            : isDark
              ? "bg-neutral-900"
              : "bg-[#f5f5f7]",
        )}
      >
        {!compact ? (
          <div
            className={cn(
              "mb-4 rounded-2xl border p-4 text-sm font-medium leading-6",
              isDark
                ? "border-white/10 bg-neutral-950 text-white/60"
                : "border-neutral-950/10 bg-white text-neutral-700",
            )}
          >
            <p
              className={cn(
                "font-semibold",
                isDark ? "text-white" : "text-neutral-950",
              )}
            >
              相手の声を拾うには
            </p>
            <p className="mt-2">
              Zoom/Meetをブラウザで開き、録音開始後の共有ダイアログで「タブ」を選びます。Macでは画面全体やウィンドウ共有では音声が付かないことがあります。
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p
              className={cn(
                "text-xs font-semibold uppercase tracking-[0.22em]",
                isRecording
                  ? "text-red-500"
                  : isDark
                    ? "text-white/50"
                    : "text-neutral-500",
              )}
            >
              {isRecording ? "Recording" : "Ready"}
            </p>
            <p
              className={cn(
                "mt-1 font-semibold tracking-tight",
                compact ? "text-xl" : "text-2xl",
              )}
            >
              {isRecording
                ? `${sourceLabel}を録音中`
                : isConnecting
                  ? `${sourceLabel}に接続中`
                  : "録音を開始できます"}
            </p>
          </div>
          {isRecording ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white">
              <span
                className="h-2.5 w-2.5 rounded-full bg-white motion-safe:animate-pulse"
                aria-hidden
              />
              LIVE
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-xs font-semibold",
              isDark ? "text-white/50" : "text-neutral-500",
            )}
          >
            文字起こし
          </span>
          <div
            className={cn(
              "inline-flex rounded-full p-1",
              isDark ? "bg-white/10" : "bg-white",
            )}
          >
            {transcriptionDelayOptions.map((option) => {
              const isSelected = transcriptionDelay === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTranscriptionDelay(option.value)}
                  disabled={isAudioBusy}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                    isSelected
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : isDark
                        ? "text-white/60 hover:text-white"
                        : "text-neutral-500 hover:text-neutral-950",
                  )}
                  aria-pressed={isSelected}
                >
                  {option.label}
                  <span
                    className={cn(
                      "text-[10px] font-semibold",
                      isSelected
                        ? "text-white/75"
                        : isDark
                          ? "text-white/35"
                          : "text-neutral-400",
                    )}
                  >
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <button
            type="button"
            onClick={startRemoteAudio}
            disabled={isAudioBusy}
            className={cn(
              "inline-flex items-center justify-center gap-3 px-5 font-semibold shadow-sm transition disabled:cursor-not-allowed",
              compact
                ? "min-h-12 rounded-2xl text-sm"
                : "min-h-16 rounded-3xl text-base",
              isRecording && activeSource === "remote"
                ? "bg-red-600 text-white"
                : "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:bg-[#86868b]",
            )}
          >
            <MonitorUp className="h-5 w-5" aria-hidden />
            {isRecording && activeSource === "remote"
              ? "録音中"
              : "Zoom/Meetタブ音声を録音"}
          </button>
          <button
            type="button"
            onClick={stopAll}
            disabled={!isAudioBusy}
            className={cn(
              "inline-flex items-center justify-center gap-3 border px-5 font-semibold shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-neutral-400",
              compact
                ? "min-h-12 rounded-2xl text-sm"
                : "min-h-16 rounded-3xl text-base",
              isDark
                ? "border-red-500/40 bg-neutral-950 text-red-300 hover:bg-red-950/30 disabled:border-white/10"
                : "border-red-300 bg-white text-red-700 disabled:border-neutral-950/10",
            )}
          >
            <Square className="h-5 w-5" aria-hidden />
            停止
          </button>
        </div>

        <button
          type="button"
          onClick={startMic}
          disabled={isAudioBusy}
          className={cn(
            "mt-3 inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:text-neutral-400",
            isDark
              ? "border-white/10 bg-neutral-950 text-white hover:border-white/30"
              : "border-neutral-950/15 bg-white text-neutral-900 hover:border-neutral-950",
          )}
        >
          <Mic className="h-4 w-4" aria-hidden />
          マイクのみ開始
        </button>
      </div>

      {error || transcription.error ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          {error ?? transcription.error}
        </p>
      ) : null}

      {showTranscript ? (
        <div className="mt-4 grid gap-2">
          <h3 className="text-sm font-semibold">リアルタイム文字起こし</h3>
          <div
            ref={transcriptScrollRef}
            onScroll={updateTranscriptScrollMode}
            className={cn(
              "flex h-[calc(var(--transcript-lines)*1.5rem+3rem)] [--transcript-lines:4] flex-col overflow-y-auto rounded-2xl sm:[--transcript-lines:6] lg:[--transcript-lines:8]",
              isDark ? "bg-neutral-900" : "bg-neutral-50",
            )}
          >
            {!transcriptTextForDisplay ? (
              <p
                className={cn(
                  "mt-auto p-4 text-sm font-medium",
                  isDark ? "text-white/40" : "text-neutral-500",
                )}
              >
                まだ文字起こしはありません。
              </p>
            ) : (
              <pre
                className={cn(
                  "whitespace-pre-wrap p-4 text-sm font-medium leading-6",
                  isDark ? "text-white/80" : "text-neutral-800",
                )}
              >
                {transcriptTextForDisplay}
              </pre>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
