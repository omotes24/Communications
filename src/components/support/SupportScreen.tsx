"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AnswerWorkbench } from "@/components/answer/AnswerWorkbench";
import { PreInterviewLearningPanel } from "@/components/answer/PreInterviewLearningPanel";
import { AudioCapturePanel } from "@/components/audio/AudioCapturePanel";
import { formatTranscriptItemsForReading } from "@/components/audio/transcript-items";
import type { TranscriptItem } from "@/components/audio/use-realtime-transcription";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import { cn } from "@/lib/utils";

type RealtimeTranscriptPanelProps = {
  items: TranscriptItem[];
  tone?: "light" | "dark";
  compact?: boolean;
};

function RealtimeTranscriptPanel({
  items,
  tone = "light",
  compact = false,
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
        compact
          ? "rounded-[24px] p-3 shadow-sm ring-1"
          : "rounded-[30px] p-4 shadow-sm ring-1",
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
          <h2
            className={cn(
              "mt-1 font-semibold tracking-tight",
              compact ? "text-lg" : "text-xl",
            )}
          >
            リアルタイム文字起こし
          </h2>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={updateScrollMode}
        className={cn(
          "flex h-[calc(var(--transcript-lines)*1.5rem+3rem)] flex-col overflow-y-auto rounded-2xl border",
          compact
            ? "mt-2 [--transcript-lines:3] sm:[--transcript-lines:4] lg:[--transcript-lines:5]"
            : "mt-3 [--transcript-lines:4] sm:[--transcript-lines:6] lg:[--transcript-lines:8]",
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
  const screenRef = useRef<HTMLElement | null>(null);
  const pinchDeltaRef = useRef(0);
  const [compact, setCompact] = useState(false);
  const [latestTranscript, setLatestTranscript] = useState<{
    id: string;
    text: string;
    createdAt: string;
  } | null>(null);
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([]);

  useEffect(() => {
    const screen = screenRef.current;
    if (!screen) {
      return;
    }

    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey) {
        return;
      }
      event.preventDefault();
      pinchDeltaRef.current += event.deltaY;
      if (pinchDeltaRef.current > 28) {
        setCompact(true);
        pinchDeltaRef.current = 0;
      }
      if (pinchDeltaRef.current < -28) {
        setCompact(false);
        pinchDeltaRef.current = 0;
      }
    }

    screen.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      screen.removeEventListener("wheel", handleWheel);
    };
  }, []);

  function confirmQuestion(text: string) {
    setLatestTranscript({
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <section ref={screenRef}>
      <PageHeader
        title={isEnglish ? "英語面接" : "面接"}
        tone={tone}
        compact={compact}
      />
      {activeCompanyName ? (
        <div
          className={cn(
            compact
              ? "mb-3 rounded-[24px] p-4 shadow-sm ring-1"
              : "mb-4 rounded-[30px] p-6 shadow-sm ring-1",
            "bg-white ring-black/[0.06]",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Current Company
          </p>
          <h2
            className={cn(
              "mt-2 font-semibold tracking-tight text-[#1d1d1f]",
              compact ? "text-2xl" : "text-3xl",
            )}
          >
            {activeCompanyName}の{isEnglish ? "英語面接" : "面接"}
            を始めましょう！
          </h2>
        </div>
      ) : null}
      <div className={cn("grid", compact ? "gap-2" : "gap-4")}>
        <PreInterviewLearningPanel
          learningLanguage={isEnglish ? "en" : "ja"}
          compact={compact}
        />
        <AnswerWorkbench
          mode="support"
          initialQuestion={latestTranscript?.text ?? ""}
          autoSource={latestTranscript ? "remote-audio" : "manual"}
          autoGenerate={Boolean(latestTranscript)}
          autoRunId={latestTranscript?.id}
          answerLanguage={isEnglish ? "en" : "ja"}
          tone={tone}
          compact={compact}
          transcriptPanel={
            <RealtimeTranscriptPanel
              items={transcriptItems}
              tone={tone}
              compact={compact}
            />
          }
        />
        <AudioCapturePanel
          autoSubmitRemoteFinal
          onRemoteTranscript={confirmQuestion}
          onTranscriptItemsChange={setTranscriptItems}
          showTranscript={false}
          tone={tone}
          compact={compact}
        />
      </div>
    </section>
  );
}
