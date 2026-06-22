"use client";

import { useState } from "react";

import { AnswerWorkbench } from "@/components/answer/AnswerWorkbench";
import { PreInterviewLearningPanel } from "@/components/answer/PreInterviewLearningPanel";
import { AudioCapturePanel } from "@/components/audio/AudioCapturePanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStorage } from "@/lib/storage/use-app-storage";

export function SupportScreen() {
  const { storage } = useAppStorage();
  const activeCompany = storage.companies[0] ?? null;
  const activeCompanyName = activeCompany?.companyName || activeCompany?.label;
  const [selectedTranscript, setSelectedTranscript] = useState<{
    id: string;
    text: string;
  } | null>(null);

  return (
    <section>
      <PageHeader
        title="面接"
        description="面接前に学習し、質問を入力または録音して回答案を作ります。"
      />
      <div className="mb-4 rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0071e3]">
          Current Company
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d1d1f]">
          {activeCompanyName
            ? `${activeCompanyName}の面接を始めましょう！`
            : "会社スロットを作成して面接を始めましょう。"}
        </h2>
      </div>
      <div className="grid gap-4">
        <PreInterviewLearningPanel />
        <AudioCapturePanel
          autoSubmitRemoteFinal
          onRemoteTranscript={(text) =>
            setSelectedTranscript({ id: crypto.randomUUID(), text })
          }
        />
        <AnswerWorkbench
          key={selectedTranscript?.id ?? "manual"}
          mode="support"
          initialQuestion={selectedTranscript?.text ?? ""}
          autoSource={selectedTranscript ? "remote-audio" : "manual"}
          autoGenerate={Boolean(selectedTranscript)}
          autoRunId={selectedTranscript?.id}
        />
      </div>
    </section>
  );
}
