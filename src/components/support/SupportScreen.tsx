"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Wand2 } from "lucide-react";

import { AnswerWorkbench } from "@/components/answer/AnswerWorkbench";
import { PreInterviewLearningPanel } from "@/components/answer/PreInterviewLearningPanel";
import { AudioCapturePanel } from "@/components/audio/AudioCapturePanel";
import type { TranscriptItem } from "@/components/audio/use-realtime-transcription";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  extractLikelyInterviewQuestion,
  isSubmittableTranscript,
  normalizeTranscriptForSubmit,
} from "@/components/audio/transcript-auto-submit";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import { cn } from "@/lib/utils";

type RealtimeTranscriptPanelProps = {
  items: TranscriptItem[];
  onConfirm: (text: string) => void;
  tone?: "light" | "dark";
};

function RealtimeTranscriptPanel({
  items,
  onConfirm,
  tone = "light",
}: RealtimeTranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const visibleItems = useMemo(() => items.slice().reverse(), [items]);
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

  function confirmItem(item: TranscriptItem) {
    const normalizedText = normalizeTranscriptForSubmit(item.text);
    const questionCandidate =
      extractLikelyInterviewQuestion(normalizedText) || normalizedText;
    if (isSubmittableTranscript(questionCandidate)) {
      onConfirm(questionCandidate);
    }
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
          "mt-3 flex h-[calc(var(--transcript-lines)*1.5rem+3rem)] [--transcript-lines:4] flex-col overflow-y-auto overscroll-contain rounded-2xl border sm:[--transcript-lines:6] lg:[--transcript-lines:8]",
          isDark
            ? "border-white/10 bg-neutral-900"
            : "border-neutral-950/10 bg-[#f5f5f7]",
        )}
      >
        {visibleItems.length === 0 ? (
          <p
            className={cn(
              "mt-auto p-4 text-sm font-medium",
              isDark ? "text-white/40" : "text-[#86868b]",
            )}
          >
            まだ文字起こしはありません。
          </p>
        ) : (
          visibleItems.map((item) => {
            const canConfirm =
              item.source === "remote" && isSubmittableTranscript(item.text);

            return (
              <div
                key={`${item.id}-${item.createdAt}`}
                className={cn(
                  "border-b p-3 last:border-b-0",
                  isDark ? "border-white/10" : "border-neutral-950/10",
                )}
              >
                <div
                  className={cn(
                    "mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold",
                    isDark ? "text-white/45" : "text-[#6e6e73]",
                  )}
                >
                  <span>{item.source === "remote" ? "相手側" : "自分側"}</span>
                  <span>{item.final ? "確定" : "入力中"}</span>
                </div>
                <p
                  className={cn(
                    "whitespace-pre-wrap text-[13px] font-medium leading-6",
                    isDark ? "text-white/80" : "text-[#1d1d1f]",
                  )}
                >
                  {item.text}
                </p>
                {canConfirm ? (
                  <button
                    type="button"
                    onClick={() => confirmItem(item)}
                    className={cn(
                      "mt-2 inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition",
                      isDark
                        ? "border-white/10 bg-neutral-950 text-white hover:border-white/30"
                        : "border-neutral-950/15 bg-white hover:border-neutral-950",
                    )}
                  >
                    <Wand2 className="h-3.5 w-3.5" aria-hidden />
                    質問を確定
                  </button>
                ) : null}
              </div>
            );
          })
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
              onConfirm={confirmQuestion}
              tone={tone}
            />
          }
        />
      </div>
    </section>
  );
}
