"use client";

import { useCallback, useRef, useState } from "react";

import {
  normalizeCommonTranscriptErrors,
  normalizeTranscriptForSubmit,
} from "@/components/audio/transcript-auto-submit";
import type { RealtimeTranscriptionDelay } from "@/lib/openai/transcription-delay";

export type TranscriptItem = {
  id: string;
  source: "local" | "remote";
  text: string;
  final: boolean;
  createdAt: number;
};

type RealtimeEvent = {
  type?: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
  error?: { code?: string; message?: string };
};

// 無音のまま commit したときなどに返る、無視してよいエラー
const ignorableRealtimeErrorCodes = new Set([
  "input_audio_buffer_commit_empty",
]);
// Realtime の1セッションには時間の上限があり、回線の瞬断でも切れる。
// 面接の途中で文字起こしが止まらないよう、切れたら自動でつなぎ直す。
const realtimeReconnectWindowMs = 5 * 60_000;
const maxRealtimeReconnectsPerWindow = 4;
const realtimeReconnectDelayMs = 800;

type RealtimeSessionResponse = {
  value?: string;
  provider?: "openai" | "groq";
  model?: string;
  reservationExpiresAt?: string;
  reservationSeconds?: number;
};

type RealtimeTranscriptionOptions = {
  transcriptionDelay?: RealtimeTranscriptionDelay;
};

const groqSegmentMs = 2800;
const realtimeCommitIntervalMs = 1800;
const realtimeRenewalLeadMs = 15_000;

function getSupportedAudioMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function recordAudioSegment(
  stream: MediaStream,
  durationMs: number,
  onRecorder: (recorder: MediaRecorder) => void,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof MediaRecorder === "undefined") {
      reject(new Error("このブラウザは音声録音に対応していません"));
      return;
    }

    const mimeType = getSupportedAudioMimeType();
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    onRecorder(recorder);

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });
    recorder.addEventListener("error", () => {
      reject(new Error("音声録音に失敗しました"));
    });
    recorder.addEventListener("stop", () => {
      resolve(
        new Blob(chunks, {
          type: recorder.mimeType || mimeType || "audio/webm",
        }),
      );
    });

    recorder.start();
    window.setTimeout(() => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    }, durationMs);
  });
}

export function useRealtimeTranscription() {
  const [status, setStatus] = useState<
    "idle" | "connecting" | "live" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const realtimeCommitIntervalRef = useRef<number | null>(null);
  const realtimeRenewalTimerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkSessionRef = useRef<{
    stopped: boolean;
    stream: MediaStream;
  } | null>(null);
  // start / stop のたびに増える。古い接続のイベントで状態を変えないために使う。
  const sessionCounterRef = useRef(0);
  const reconnectAttemptsRef = useRef<number[]>([]);
  const activeStreamRef = useRef<MediaStream | null>(null);

  const stop = useCallback((options: { stopTracks?: boolean } = {}) => {
    sessionCounterRef.current += 1;
    const stopTracks = options.stopTracks ?? true;
    if (stopTracks) {
      activeStreamRef.current = null;
    }
    if (realtimeRenewalTimerRef.current) {
      window.clearTimeout(realtimeRenewalTimerRef.current);
      realtimeRenewalTimerRef.current = null;
    }
    if (realtimeCommitIntervalRef.current) {
      window.clearInterval(realtimeCommitIntervalRef.current);
      realtimeCommitIntervalRef.current = null;
    }
    if (chunkSessionRef.current) {
      chunkSessionRef.current.stopped = true;
      if (stopTracks) {
        chunkSessionRef.current.stream
          .getTracks()
          .forEach((track) => track.stop());
      }
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    channelRef.current?.close();
    if (stopTracks) {
      peerRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    }
    peerRef.current?.close();
    channelRef.current = null;
    peerRef.current = null;
    mediaRecorderRef.current = null;
    chunkSessionRef.current = null;
    setStatus("idle");
  }, []);

  async function requestRealtimeSession(
    options: RealtimeTranscriptionOptions = {},
  ): Promise<RealtimeSessionResponse> {
    const tokenResponse = await fetch("/api/realtime-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-operation-id": crypto.randomUUID(),
        "x-request-id": crypto.randomUUID(),
      },
      body: JSON.stringify({
        transcriptionDelay: options.transcriptionDelay,
      }),
    });
    if (!tokenResponse.ok) {
      throw new Error("Realtime セッションを作成できませんでした");
    }
    return (await tokenResponse.json()) as RealtimeSessionResponse;
  }

  function scheduleRealtimeReservationRenewal(
    stream: MediaStream,
    reservationSeconds: number | undefined,
    options: RealtimeTranscriptionOptions,
  ) {
    if (realtimeRenewalTimerRef.current) {
      window.clearTimeout(realtimeRenewalTimerRef.current);
      realtimeRenewalTimerRef.current = null;
    }
    const reservationMs = Math.max(
      1000,
      Math.floor((reservationSeconds ?? 180) * 1000),
    );
    const renewalLeadMs = Math.min(
      realtimeRenewalLeadMs,
      Math.max(1000, Math.floor(reservationMs / 3)),
    );
    const renewalDelayMs = Math.max(1000, reservationMs - renewalLeadMs);

    realtimeRenewalTimerRef.current = window.setTimeout(() => {
      if (
        stream.getAudioTracks().every((track) => track.readyState === "ended")
      ) {
        return;
      }
      void requestRealtimeSession(options)
        .then((nextSession) => {
          setError(null);
          scheduleRealtimeReservationRenewal(
            stream,
            nextSession.reservationSeconds,
            options,
          );
        })
        .catch((caught) => {
          setError(
            caught instanceof Error
              ? caught.message
              : "Realtime予約の更新に失敗しました。録音は継続中です。自動で再試行します。",
          );
          realtimeRenewalTimerRef.current = window.setTimeout(() => {
            scheduleRealtimeReservationRenewal(stream, 30, options);
          }, 10_000);
        });
    }, renewalDelayMs);
  }

  const startChunkedTranscription = useCallback(
    async (stream: MediaStream, source: "local" | "remote") => {
      const session = { stopped: false, stream };
      chunkSessionRef.current = session;
      setStatus("live");

      while (!session.stopped) {
        const blob = await recordAudioSegment(
          stream,
          groqSegmentMs,
          (recorder) => {
            mediaRecorderRef.current = recorder;
          },
        );
        if (session.stopped || blob.size === 0) {
          continue;
        }

        const id = crypto.randomUUID();
        setItems((current) => [
          {
            id,
            source,
            text: "...",
            final: false,
            createdAt: Date.now(),
          },
          ...current,
        ]);

        try {
          const formData = new FormData();
          formData.append("audio", blob, `audio-${Date.now()}.webm`);
          const response = await fetch("/api/transcribe-audio", {
            method: "POST",
            headers: {
              "x-operation-id": crypto.randomUUID(),
              "x-request-id": crypto.randomUUID(),
            },
            body: formData,
          });
          if (!response.ok) {
            throw new Error("音声文字起こしに失敗しました");
          }
          const data = (await response.json()) as { text?: string };
          const text = normalizeTranscriptForSubmit(data.text ?? "");
          setItems((current) => {
            if (!text) {
              return current.filter((item) => item.id !== id);
            }
            return current.map((item) =>
              item.id === id ? { ...item, text, final: true } : item,
            );
          });
        } catch (caught) {
          setItems((current) => current.filter((item) => item.id !== id));
          setError(
            caught instanceof Error ? caught.message : "音声文字起こしエラー",
          );
        }
      }
    },
    [],
  );

  async function start(
    stream: MediaStream,
    source: "local" | "remote",
    options: RealtimeTranscriptionOptions = {},
    mode: { reconnect?: boolean } = {},
  ) {
    // つなぎ直しのときは共有中の音声トラックを止めない
    stop({ stopTracks: !mode.reconnect });
    const sessionId = sessionCounterRef.current;
    const isCurrentSession = () => sessionCounterRef.current === sessionId;
    setStatus("connecting");
    if (!mode.reconnect) {
      setError(null);
      reconnectAttemptsRef.current = [];
    }

    const reconnect = (reason: string) => {
      if (!isCurrentSession()) {
        return;
      }
      if (
        stream.getAudioTracks().every((track) => track.readyState === "ended")
      ) {
        stop();
        setError(
          "画面・タブの共有が終了したため、文字起こしを止めました。もう一度録音を開始してください。",
        );
        return;
      }
      const now = Date.now();
      reconnectAttemptsRef.current = reconnectAttemptsRef.current.filter(
        (attemptAt) => now - attemptAt < realtimeReconnectWindowMs,
      );
      if (
        reconnectAttemptsRef.current.length >= maxRealtimeReconnectsPerWindow
      ) {
        stop({ stopTracks: false });
        setStatus("error");
        setError(
          `文字起こしの接続が何度も切れました（${reason}）。停止してから、もう一度録音を開始してください。`,
        );
        return;
      }
      reconnectAttemptsRef.current.push(now);
      setError(
        `文字起こしの接続が切れたため、つなぎ直しています（${reason}）。`,
      );
      sessionCounterRef.current += 1;
      window.setTimeout(() => {
        void start(stream, source, options, { reconnect: true });
      }, realtimeReconnectDelayMs);
    };

    activeStreamRef.current = stream;
    if (!mode.reconnect) {
      // ブラウザの「共有を停止」で音声トラックが終わったら、録音中のままにしない
      // （track.stop() では ended は発火しないので、こちらから止めた場合は来ない）
      stream.getAudioTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          if (
            activeStreamRef.current === stream &&
            stream.getAudioTracks().every((item) => item.readyState === "ended")
          ) {
            stop();
            setError(
              "画面・タブの共有が終了したため、文字起こしを止めました。もう一度録音を開始してください。",
            );
          }
        });
      });
    }

    try {
      const tokenData = await requestRealtimeSession(options);
      scheduleRealtimeReservationRenewal(
        stream,
        tokenData.reservationSeconds,
        options,
      );
      if (tokenData.provider === "groq") {
        void startChunkedTranscription(stream, source).catch((caught) => {
          setError(
            caught instanceof Error ? caught.message : "音声文字起こしエラー",
          );
          setStatus("error");
        });
        return;
      }

      const token = tokenData.value;
      if (!token || token.startsWith("mock-")) {
        setItems((current) => [
          {
            id: crypto.randomUUID(),
            source,
            text: "モックモードでは実音声の文字起こしは行いません。手動入力を使用してください。",
            final: true,
            createdAt: Date.now(),
          },
          ...current,
        ]);
        setStatus("live");
        return;
      }

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));
      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;

      channel.addEventListener("open", () => {
        realtimeCommitIntervalRef.current = window.setInterval(() => {
          if (channel.readyState !== "open") {
            return;
          }
          channel.send(
            JSON.stringify({
              type: "input_audio_buffer.commit",
            }),
          );
        }, realtimeCommitIntervalMs);
      });

      channel.addEventListener("close", () => {
        if (realtimeCommitIntervalRef.current) {
          window.clearInterval(realtimeCommitIntervalRef.current);
          realtimeCommitIntervalRef.current = null;
        }
        // こちらから止めたのでなければ、セッションの上限や回線断で切れた
        reconnect("セッション終了");
      });

      let disconnectedTimer: number | null = null;
      peer.addEventListener("connectionstatechange", () => {
        if (!isCurrentSession()) {
          return;
        }
        if (peer.connectionState === "failed") {
          reconnect("接続失敗");
          return;
        }
        if (peer.connectionState === "disconnected") {
          // 一時的な瞬断は自然に戻ることがあるので、少し待ってから判断する
          disconnectedTimer = window.setTimeout(() => {
            if (isCurrentSession() && peer.connectionState === "disconnected") {
              reconnect("回線断");
            }
          }, 4000);
          return;
        }
        if (disconnectedTimer) {
          window.clearTimeout(disconnectedTimer);
          disconnectedTimer = null;
        }
      });

      channel.addEventListener("message", (event) => {
        const data = JSON.parse(event.data as string) as RealtimeEvent;
        if (data.type === "error") {
          const code = data.error?.code ?? "";
          if (!ignorableRealtimeErrorCodes.has(code) && isCurrentSession()) {
            setError(
              `文字起こしでエラーが発生しました${code ? `（${code}）` : ""}。続く場合は停止して録音し直してください。`,
            );
          }
          return;
        }
        if (data.type === "conversation.item.input_audio_transcription.delta") {
          setItems((current) => {
            const id = data.item_id ?? "pending";
            const delta = normalizeCommonTranscriptErrors(data.delta ?? "");
            const existing = current.find((item) => item.id === id);
            if (!existing) {
              return [
                {
                  id,
                  source,
                  text: delta,
                  final: false,
                  createdAt: Date.now(),
                },
                ...current,
              ];
            }
            return current.map((item) =>
              item.id === id
                ? {
                    ...item,
                    text: normalizeCommonTranscriptErrors(
                      `${item.text}${data.delta ?? ""}`,
                    ),
                  }
                : item,
            );
          });
        }
        if (
          data.type === "conversation.item.input_audio_transcription.completed"
        ) {
          setItems((current) => {
            const id = data.item_id ?? crypto.randomUUID();
            const transcript = normalizeTranscriptForSubmit(
              data.transcript ?? "",
            );
            const existing = current.some((item) => item.id === id);
            if (!existing) {
              return [
                {
                  id,
                  source,
                  text: transcript,
                  final: true,
                  createdAt: Date.now(),
                },
                ...current,
              ];
            }
            return current.map((item) =>
              item.id === id
                ? {
                    ...item,
                    text: transcript || item.text,
                    final: true,
                  }
                : item,
            );
          });
        }
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const sdpResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls",
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/sdp",
          },
        },
      );
      if (!sdpResponse.ok) {
        throw new Error("Realtime WebRTC 接続に失敗しました");
      }
      await peer.setRemoteDescription({
        type: "answer",
        sdp: await sdpResponse.text(),
      });
      if (!isCurrentSession()) {
        return;
      }
      setStatus("live");
      if (mode.reconnect) {
        setError(null);
      }
    } catch (caught) {
      if (!isCurrentSession()) {
        return;
      }
      if (mode.reconnect) {
        reconnect("再接続に失敗");
        return;
      }
      setError(caught instanceof Error ? caught.message : "音声接続エラー");
      setStatus("error");
    }
  }

  return { status, error, items, start, stop, setItems };
}
