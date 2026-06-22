"use client";

import { useCallback, useRef, useState } from "react";

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
};

export function useRealtimeTranscription() {
  const [status, setStatus] = useState<
    "idle" | "connecting" | "live" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);

  const stop = useCallback(() => {
    channelRef.current?.close();
    peerRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    peerRef.current?.close();
    channelRef.current = null;
    peerRef.current = null;
    setStatus("idle");
  }, []);

  const start = useCallback(
    async (stream: MediaStream, source: "local" | "remote") => {
      stop();
      setStatus("connecting");
      setError(null);

      try {
        const tokenResponse = await fetch("/api/realtime-session", {
          method: "POST",
        });
        if (!tokenResponse.ok) {
          throw new Error("Realtime セッションを作成できませんでした");
        }
        const tokenData = (await tokenResponse.json()) as { value?: string };
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
        stream
          .getAudioTracks()
          .forEach((track) => peer.addTrack(track, stream));
        const channel = peer.createDataChannel("oai-events");
        channelRef.current = channel;

        channel.addEventListener("message", (event) => {
          const data = JSON.parse(event.data as string) as RealtimeEvent;
          if (
            data.type === "conversation.item.input_audio_transcription.delta"
          ) {
            setItems((current) => {
              const id = data.item_id ?? "pending";
              const existing = current.find((item) => item.id === id);
              if (!existing) {
                return [
                  {
                    id,
                    source,
                    text: data.delta ?? "",
                    final: false,
                    createdAt: Date.now(),
                  },
                  ...current,
                ];
              }
              return current.map((item) =>
                item.id === id
                  ? { ...item, text: `${item.text}${data.delta ?? ""}` }
                  : item,
              );
            });
          }
          if (
            data.type ===
            "conversation.item.input_audio_transcription.completed"
          ) {
            setItems((current) => {
              const id = data.item_id ?? crypto.randomUUID();
              const existing = current.some((item) => item.id === id);
              if (!existing) {
                return [
                  {
                    id,
                    source,
                    text: data.transcript ?? "",
                    final: true,
                    createdAt: Date.now(),
                  },
                  ...current,
                ];
              }
              return current.map((item) =>
                item.id === id
                  ? { ...item, text: data.transcript ?? item.text, final: true }
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
        setStatus("live");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "音声接続エラー");
        setStatus("error");
      }
    },
    [stop],
  );

  return { status, error, items, start, stop, setItems };
}
