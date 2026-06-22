"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MonitorUp, Square, Wand2 } from "lucide-react";

import { useRealtimeTranscription } from "@/components/audio/use-realtime-transcription";
import {
  createTranscriptSubmitKey,
  isSubmittableTranscript,
  looksLikeInterviewQuestion,
  normalizeTranscriptForSubmit,
  remoteTranscriptAutoSubmitDelayMs,
  remoteTranscriptMinimumAutoSubmitGapMs,
  remoteTranscriptQuestionCueDelayMs,
} from "@/components/audio/transcript-auto-submit";
import {
  requestDisplayAudio,
  requestMicrophone,
  stopMediaStream,
} from "@/lib/audio/media";
import { cn } from "@/lib/utils";

type AudioCapturePanelProps = {
  onRemoteTranscript?: (text: string) => void;
  autoSubmitRemoteFinal?: boolean;
};

export function AudioCapturePanel({
  onRemoteTranscript,
  autoSubmitRemoteFinal = false,
}: AudioCapturePanelProps) {
  const transcription = useRealtimeTranscription();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [activeSource, setActiveSource] = useState<"remote" | "local" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const submittedIdsRef = useRef<Set<string>>(new Set());
  const pendingPauseSubmitTimerRef = useRef<number | null>(null);
  const pendingQuestionCueSubmitTimerRef = useRef<number | null>(null);
  const lastAutoSubmittedAtRef = useRef(0);
  const latestRemoteCandidateRef = useRef<{ id: string; text: string } | null>(
    null,
  );

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

  const clearPendingRemoteSubmitTimers = useCallback(() => {
    if (pendingPauseSubmitTimerRef.current) {
      window.clearTimeout(pendingPauseSubmitTimerRef.current);
      pendingPauseSubmitTimerRef.current = null;
    }
    if (pendingQuestionCueSubmitTimerRef.current) {
      window.clearTimeout(pendingQuestionCueSubmitTimerRef.current);
      pendingQuestionCueSubmitTimerRef.current = null;
    }
  }, []);

  const submitRemoteTranscript = useCallback(
    (id: string, text: string, enforceAutoSubmitGap: boolean) => {
      if (!onRemoteTranscript) {
        return;
      }
      const normalizedText = normalizeTranscriptForSubmit(text);
      if (!isSubmittableTranscript(normalizedText)) {
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
      lastAutoSubmittedAtRef.current = Date.now();
      onRemoteTranscript(normalizedText);
    },
    [onRemoteTranscript],
  );

  useEffect(() => {
    if (!autoSubmitRemoteFinal || !onRemoteTranscript) {
      return;
    }

    const latestRemoteItem = transcription.items.find(
      (item) => item.source === "remote" && isSubmittableTranscript(item.text),
    );
    if (!latestRemoteItem) {
      return;
    }

    const normalizedText = normalizeTranscriptForSubmit(latestRemoteItem.text);
    latestRemoteCandidateRef.current = {
      id: latestRemoteItem.id,
      text: normalizedText,
    };

    if (pendingPauseSubmitTimerRef.current) {
      window.clearTimeout(pendingPauseSubmitTimerRef.current);
      pendingPauseSubmitTimerRef.current = null;
    }

    if (latestRemoteItem.final) {
      clearPendingRemoteSubmitTimers();
      submitRemoteTranscript(latestRemoteItem.id, normalizedText, false);
      return;
    }

    if (
      looksLikeInterviewQuestion(normalizedText) &&
      !pendingQuestionCueSubmitTimerRef.current &&
      Date.now() - lastAutoSubmittedAtRef.current >=
        remoteTranscriptMinimumAutoSubmitGapMs
    ) {
      pendingQuestionCueSubmitTimerRef.current = window.setTimeout(() => {
        pendingQuestionCueSubmitTimerRef.current = null;
        const candidate = latestRemoteCandidateRef.current;
        if (candidate) {
          submitRemoteTranscript(candidate.id, candidate.text, true);
        }
      }, remoteTranscriptQuestionCueDelayMs);
    }

    pendingPauseSubmitTimerRef.current = window.setTimeout(() => {
      pendingPauseSubmitTimerRef.current = null;
      const candidate = latestRemoteCandidateRef.current;
      if (candidate) {
        submitRemoteTranscript(candidate.id, candidate.text, true);
      }
    }, remoteTranscriptAutoSubmitDelayMs);
  }, [
    autoSubmitRemoteFinal,
    clearPendingRemoteSubmitTimers,
    onRemoteTranscript,
    submitRemoteTranscript,
    transcription.items,
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
      await transcription.start(stream, "local");
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
      await transcription.start(stream, "remote");
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
        "rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06] transition",
        isRecording ? "shadow-red-500/10 ring-red-400/60" : "ring-black/[0.06]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0071e3]">
            Audio
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            音声入力
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-neutral-600">
            Chrome/EdgeでZoomやMeetのブラウザタブを選び、タブ音声を共有すると相手の質問を文字起こしできます。
          </p>
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
          "mt-5 rounded-[24px] p-4 transition",
          isRecording ? "bg-red-50 ring-1 ring-red-200" : "bg-[#f5f5f7]",
        )}
      >
        <div className="mb-4 rounded-2xl border border-neutral-950/10 bg-white p-4 text-sm font-medium leading-6 text-neutral-700">
          <p className="font-semibold text-neutral-950">相手の声を拾うには</p>
          <p className="mt-2">
            Zoom/Meetをブラウザで開き、録音開始後の共有ダイアログで「タブ」を選びます。Macでは画面全体やウィンドウ共有では音声が付かないことがあります。
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p
              className={cn(
                "text-xs font-semibold uppercase tracking-[0.22em]",
                isRecording ? "text-red-600" : "text-neutral-500",
              )}
            >
              {isRecording ? "Recording" : "Ready"}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
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

        <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <button
            type="button"
            onClick={startRemoteAudio}
            disabled={isAudioBusy}
            className={cn(
              "inline-flex min-h-16 items-center justify-center gap-3 rounded-3xl px-5 text-base font-semibold shadow-sm transition disabled:cursor-not-allowed",
              isRecording && activeSource === "remote"
                ? "bg-red-600 text-white"
                : "bg-[#0071e3] text-white hover:bg-[#147ce5] disabled:bg-[#86868b]",
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
            className="inline-flex min-h-16 items-center justify-center gap-3 rounded-3xl border border-red-300 bg-white px-5 text-base font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-neutral-950/10 disabled:text-neutral-400"
          >
            <Square className="h-5 w-5" aria-hidden />
            停止
          </button>
        </div>

        <button
          type="button"
          onClick={startMic}
          disabled={isAudioBusy}
          className="mt-3 inline-flex h-11 items-center gap-2 rounded-full border border-neutral-950/15 bg-white px-5 text-sm font-semibold text-neutral-900 transition hover:border-neutral-950 disabled:cursor-not-allowed disabled:text-neutral-400"
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

      <div className="mt-4 grid gap-2">
        <h3 className="text-sm font-semibold">リアルタイム文字起こし</h3>
        {transcription.items.length === 0 ? (
          <p className="rounded-2xl bg-neutral-50 p-4 text-sm font-medium text-neutral-500">
            まだ文字起こしはありません。
          </p>
        ) : (
          transcription.items.slice(0, 6).map((item) => (
            <div
              key={`${item.id}-${item.createdAt}`}
              className="rounded-2xl border border-neutral-950/10 p-4"
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-neutral-500">
                <span>{item.source === "remote" ? "相手側" : "自分側"}</span>
                <span>{item.final ? "確定" : "入力中"}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-800">
                {item.text}
              </p>
              {item.source === "remote" &&
              isSubmittableTranscript(item.text) &&
              onRemoteTranscript ? (
                <button
                  type="button"
                  onClick={() =>
                    onRemoteTranscript(normalizeTranscriptForSubmit(item.text))
                  }
                  className="mt-3 inline-flex h-9 items-center gap-2 rounded-full border border-neutral-950/15 px-3 text-xs font-semibold transition hover:border-neutral-950"
                >
                  <Wand2 className="h-3.5 w-3.5" aria-hidden />
                  この発話から回答案を作成
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
