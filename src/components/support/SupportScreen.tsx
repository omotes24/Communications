"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { AnswerWorkbench } from "@/components/answer/AnswerWorkbench";
import { PreInterviewLearningPanel } from "@/components/answer/PreInterviewLearningPanel";
import { AudioCapturePanel } from "@/components/audio/AudioCapturePanel";
import { formatTranscriptItemsForReading } from "@/components/audio/transcript-items";
import type { TranscriptItem } from "@/components/audio/use-realtime-transcription";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import { cn } from "@/lib/utils";
import type { InterviewLaunchContext } from "@/modules/interview/contract";

const minInterviewScale = 0.62;
const maxInterviewScale = 1;
const compactScaleThreshold = 0.92;

function clampInterviewScale(value: number) {
  return Math.min(maxInterviewScale, Math.max(minInterviewScale, value));
}

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
          ? "rounded-2xl p-3 shadow-none ring-1"
          : "rounded-[18px] p-3 shadow-none ring-1",
        isDark
          ? "bg-neutral-950 text-white ring-white/10"
          : "bg-white ring-black/[0.06]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[8pt] font-medium tracking-normal">
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
            ? "mt-1.5 [--transcript-lines:3] sm:[--transcript-lines:4] lg:[--transcript-lines:5]"
            : "mt-2 [--transcript-lines:4] sm:[--transcript-lines:6] lg:[--transcript-lines:8]",
          isDark
            ? "border-white/10 bg-neutral-900"
            : "border-neutral-950/10 bg-[#f5f5f7]",
        )}
      >
        {!transcriptText ? (
          <p
            className={cn(
              "mt-auto p-4 text-xs font-medium",
              isDark ? "text-white/40" : "text-[#86868b]",
            )}
          >
            まだ文字起こしはありません。
          </p>
        ) : (
          <pre
            className={cn(
              "whitespace-pre-wrap p-4 text-[11px] font-medium leading-[18px]",
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
  launchContext,
}: {
  variant?: "japanese" | "english";
  launchContext?: InterviewLaunchContext;
}) {
  const { activeCompany } = useAppStorage();
  const activeCompanyName =
    launchContext?.company?.name ||
    activeCompany?.companyName ||
    activeCompany?.label;
  const isEnglish = variant === "english";
  const tone: "light" | "dark" = "light";
  const screenRef = useRef<HTMLElement | null>(null);
  const [interviewScale, setInterviewScale] = useState(maxInterviewScale);
  const compact = interviewScale < compactScaleThreshold;
  const [latestTranscript, setLatestTranscript] = useState<{
    id: string;
    text: string;
    createdAt: string;
  } | null>(null);
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([]);

  useEffect(() => {
    function handleWindowWheel(event: WheelEvent) {
      if (!event.ctrlKey) {
        return;
      }
      const screen = screenRef.current;
      const target = event.target;
      if (!screen || !(target instanceof Node) || !screen.contains(target)) {
        return;
      }
      event.preventDefault();
      setInterviewScale((current) =>
        clampInterviewScale(current - event.deltaY * 0.001),
      );
    }

    window.addEventListener("wheel", handleWindowWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleWindowWheel);
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
    <section
      ref={screenRef}
      style={{ zoom: interviewScale } as CSSProperties & { zoom: number }}
    >
      <PageHeader
        title={isEnglish ? "英語面接" : "面接"}
        description={
          isEnglish
            ? "英語での質問をリアルタイム音声で受け取り、AIがその場で回答案を生成します。"
            : "面接官の質問をリアルタイム音声で受け取り、AIがその場で回答案を生成します。"
        }
        tone={tone}
        compact={compact}
        dense
      />
      {activeCompanyName ? (
        <div
          className={cn(
            compact
              ? "mb-2 rounded-2xl p-3 shadow-none ring-1"
              : "mb-2 rounded-[18px] p-4 shadow-none ring-1",
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
      <div className={cn("grid", compact ? "gap-1" : "gap-1.5")}>
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
        <div
          aria-hidden="true"
          className={compact ? "h-[30vh]" : "h-[22vh]"}
        />
      </div>
    </section>
  );
}
