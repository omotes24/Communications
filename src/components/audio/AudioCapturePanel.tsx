"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MonitorUp, Square, Wand2 } from "lucide-react";

import {
  requestDisplayAudio,
  requestMicrophone,
  stopMediaStream,
} from "@/lib/audio/media";
import { cn } from "@/lib/utils";
import { useRealtimeTranscription } from "@/components/audio/use-realtime-transcription";

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
  const [error, setError] = useState<string | null>(null);
  const submittedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!autoSubmitRemoteFinal || !onRemoteTranscript) {
      return;
    }
    for (const item of transcription.items) {
      if (
        item.source === "remote" &&
        item.final &&
        item.text.trim() &&
        !submittedIdsRef.current.has(item.id)
      ) {
        submittedIdsRef.current.add(item.id);
        onRemoteTranscript(item.text);
      }
    }
  }, [autoSubmitRemoteFinal, onRemoteTranscript, transcription.items]);

  async function startMic() {
    try {
      setError(null);
      const stream = await requestMicrophone();
      setLocalStream(stream);
      await transcription.start(stream, "local");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "マイク取得エラー");
    }
  }

  async function startRemoteAudio() {
    try {
      setError(null);
      const stream = await requestDisplayAudio();
      setRemoteStream(stream);
      await transcription.start(stream, "remote");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "画面音声取得エラー");
    }
  }

  function stopAll() {
    transcription.stop();
    stopMediaStream(localStream);
    stopMediaStream(remoteStream);
    setLocalStream(null);
    setRemoteStream(null);
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">音声入力状態</h2>
          <p className="mt-1 text-xs text-slate-500">
            remoteStream は質問判定に使用し、localMicStream
            は自動生成に使いません。
          </p>
        </div>
        <span
          className={cn(
            "rounded border px-2 py-1 text-xs font-medium",
            transcription.status === "live"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-slate-50 text-slate-600",
          )}
        >
          {transcription.status}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startRemoteAudio}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white"
        >
          <MonitorUp className="h-4 w-4" aria-hidden />
          タブ・画面音声を共有
        </button>
        <button
          type="button"
          onClick={startMic}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-medium"
        >
          <Mic className="h-4 w-4" aria-hidden />
          マイクを開始
        </button>
        <button
          type="button"
          onClick={stopAll}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-red-300 px-4 text-sm font-medium text-red-700"
        >
          <Square className="h-4 w-4" aria-hidden />
          停止
        </button>
      </div>
      {error || transcription.error ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {error ?? transcription.error}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2">
        <h3 className="text-sm font-semibold">リアルタイム文字起こし</h3>
        {transcription.items.length === 0 ? (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
            まだ文字起こしはありません。
          </p>
        ) : (
          transcription.items.slice(0, 6).map((item) => (
            <div
              key={`${item.id}-${item.createdAt}`}
              className="rounded-md border border-slate-200 p-3"
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>{item.source === "remote" ? "相手側" : "自分側"}</span>
                <span>{item.final ? "確定" : "入力中"}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6">
                {item.text}
              </p>
              {item.source === "remote" && item.final && onRemoteTranscript ? (
                <button
                  type="button"
                  onClick={() => onRemoteTranscript(item.text)}
                  className="mt-2 inline-flex h-8 items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-medium"
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
