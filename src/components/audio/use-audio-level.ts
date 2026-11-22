"use client";

import { useEffect, useState } from "react";

// これを超えたら「音が来ている」とみなす（RMS。-40dBFS 程度）
const soundRmsThreshold = 0.01;
const sampleIntervalMs = 120;

export type AudioLevel = {
  // 0〜1 の表示用の音量
  level: number;
  // 最後に音が来てからの経過ミリ秒（計測開始からずっと無音ならその経過時間）
  silentMs: number;
};

const idleLevel: AudioLevel = { level: 0, silentMs: 0 };

// 共有したタブやマイクから実際に音が届いているかを、画面に出すための計測。
// 文字起こしに文字が出ないとき、「音が来ていない」のか「来ているのに文字にならない」のかを
// 切り分けられるようにする。WebRTC の送信には影響しない。
export function useAudioLevel(stream: MediaStream | null): AudioLevel {
  const [state, setState] = useState<{
    stream: MediaStream | null;
    value: AudioLevel;
  }>({ stream: null, value: idleLevel });

  useEffect(() => {
    const track = stream?.getAudioTracks()[0];
    if (!stream || !track || typeof window === "undefined") {
      return undefined;
    }
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) {
      return undefined;
    }
    const context = new AudioContextClass();
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    void context.resume().catch(() => undefined);

    const samples = new Float32Array(analyser.fftSize);
    let lastSoundAt = Date.now();
    const timer = window.setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / samples.length);
      const now = Date.now();
      if (rms > soundRmsThreshold) {
        lastSoundAt = now;
      }
      setState({
        stream,
        value: { level: Math.min(1, rms * 6), silentMs: now - lastSoundAt },
      });
    }, sampleIntervalMs);

    return () => {
      window.clearInterval(timer);
      source.disconnect();
      void context.close().catch(() => undefined);
    };
  }, [stream]);

  // 別のストリームに切り替わった直後は、前の計測値を出さない
  return state.stream === stream && stream ? state.value : idleLevel;
}
