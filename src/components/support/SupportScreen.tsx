"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AnswerWorkbench } from "@/components/answer/AnswerWorkbench";
import { PreInterviewLearningPanel } from "@/components/answer/PreInterviewLearningPanel";
import { AudioCapturePanel } from "@/components/audio/AudioCapturePanel";
import {
  formatTranscriptItemsForReading,
} from "@/components/audio/transcript-items";
import type { TranscriptItem } from "@/components/audio/use-realtime-transcription";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import { cn } from "@/lib/utils";

type RealtimeTranscriptPanelProps = {
  items: TranscriptItem[];
  tone?: "light" | "dark";
};

function RealtimeTranscriptPanel({
  items,
  tone = "light",
}: RealtimeTranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const transcriptText = useMemo(
    () => formatTranscriptItemsForReading(items),
    [items],
  );
  const isDark = tone === "dark";

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (scrollContainer && stickToBottomRef.current) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [items]);

  function updateScrollMode() {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) {
      return;
    }
    const distanceFromBottom =
      scrollContainer.scrollHeight -
      scrollContainer.scrollTop -
      scrollContainer.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 32;
  }

  return (
    <section
      className={cn(
        "rounded-[30px] p-4 shadow-sm ring-1",
        isDark
          ? "bg-neutral-950 text-white ring-white/10"
          : "bg-white ring-black/[0.06]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Live Transcript
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            リアルタイム文字起こし
          </h2>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={updateScrollMode}
        className={cn(
          "mt-3 flex h-[calc(var(--transcript-lines)*1.5rem+3rem)] [--transcript-lines:4] flex-col overflow-y-auto rounded-2xl border sm:[--transcript-lines:6] lg:[--transcript-lines:8]",
          isDark
            ? "border-white/10 bg-neutral-900"
            : "border-neutral-950/10 bg-[#f5f5f7]",
        )}
      >
        {!transcriptText ? (
          <p
            className={cn(
              "mt-auto p-4 text-sm font-medium",
              isDark ? "text-white/40" : "text-[#86868b]",
            )}
          >
            まだ文字起こしはありません。
          </p>
        ) : (
          <pre
            className={cn(
              "whitespace-pre-wrap p-4 text-[13px] font-medium leading-6",
              isDark ? "text-white/80" : "text-[#1d1d1f]",
            )}
          >
            {transcriptText}
          </pre>
        )}
      </div>
    </section>
  );
}

export function SupportScreen({
  variant = "japanese",
}: {
  variant?: "japanese" | "english";
}) {
  const { activeCompany } = useAppStorage();
  const activeCompanyName = activeCompany?.companyName || activeCompany?.label;
  const isEnglish = variant === "english";
  const tone: "light" | "dark" = "light";
  const [latestTranscript, setLatestTranscript] = useState<{
    id: string;
    text: string;
    createdAt: string;
  } | null>(null);
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([]);

  function confirmQuestion(text: string) {
    setLatestTranscript({
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <section>
      <PageHeader title={isEnglish ? "英語面接" : "面接"} tone={tone} />
      {activeCompanyName ? (
        <div
          className={cn(
            "mb-4 rounded-[30px] p-6 shadow-sm ring-1",
            "bg-white ring-black/[0.06]",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Current Company
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            {activeCompanyName}の{isEnglish ? "英語面接" : "面接"}
            を始めましょう！
          </h2>
        </div>
      ) : null}
      <div className="grid gap-4">
        <PreInterviewLearningPanel learningLanguage={isEnglish ? "en" : "ja"} />
        <AudioCapturePanel
          autoSubmitRemoteFinal
          onRemoteTranscript={confirmQuestion}
          onTranscriptItemsChange={setTranscriptItems}
          showTranscript={false}
          tone={tone}
        />
        <AnswerWorkbench
          mode="support"
          initialQuestion={latestTranscript?.text ?? ""}
          autoSource={latestTranscript ? "remote-audio" : "manual"}
          autoGenerate={Boolean(latestTranscript)}
          autoRunId={latestTranscript?.id}
          answerLanguage={isEnglish ? "en" : "ja"}
          tone={tone}
          transcriptPanel={
            <RealtimeTranscriptPanel
              items={transcriptItems}
              tone={tone}
            />
          }
        />
      </div>
    </section>
  );
}
