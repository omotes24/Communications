"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";

import { AnswerWorkbench } from "@/components/answer/AnswerWorkbench";
import { PreInterviewLearningPanel } from "@/components/answer/PreInterviewLearningPanel";
import { AudioCapturePanel } from "@/components/audio/AudioCapturePanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStorage } from "@/lib/storage/use-app-storage";

export function SupportScreen() {
  const { storage } = useAppStorage();
  const activeCompany = storage.companies[0] ?? null;
  const activeCompanyName = activeCompany?.companyName || activeCompany?.label;
  const [latestTranscript, setLatestTranscript] = useState<{
    id: string;
    text: string;
    createdAt: string;
  } | null>(null);
  const [autoSendStopped, setAutoSendStopped] = useState(false);
  const [questionCycle, setQuestionCycle] = useState(0);

  function confirmQuestion(text: string) {
    if (autoSendStopped) {
      return;
    }
    setLatestTranscript({
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString(),
    });
  }

  function toggleQuestionGate() {
    if (autoSendStopped) {
      setAutoSendStopped(false);
      setQuestionCycle((current) => current + 1);
      return;
    }
    setAutoSendStopped(true);
  }

  const gateTitle = autoSendStopped ? "自動送信を停止中" : "質問を自動送信中";
  const gateDescription = autoSendStopped
    ? "録音は続けたまま、質問検知から回答生成への自動送信だけを止めています。"
    : "質問を検知すると、人の操作なしで回答チャットへ送信し、回答案を作成します。";
  const GateIcon = autoSendStopped ? Play : Pause;

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
          autoSubmitRemoteFinal={!autoSendStopped}
          questionLocked={autoSendStopped}
          questionCycle={questionCycle}
          onRemoteTranscript={confirmQuestion}
        />
        <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0071e3]">
                Question Gate
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                {gateTitle}
              </h2>
              <p className="mt-2 text-sm font-medium leading-6 text-neutral-600">
                {gateDescription}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleQuestionGate}
              className={[
                "inline-flex min-h-14 min-w-44 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white shadow-sm transition",
                autoSendStopped
                  ? "bg-[#0071e3] hover:bg-[#147ce5]"
                  : "bg-[#1d1d1f] hover:bg-neutral-700",
              ].join(" ")}
            >
              <GateIcon className="h-4 w-4" aria-hidden />
              {autoSendStopped ? "GO 自動送信再開" : "STOP 自動送信停止"}
            </button>
          </div>
          {latestTranscript ? (
            <div className="mt-4 rounded-2xl bg-[#f5f5f7] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6e6e73]">
                直近で自動送信した質問
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-[#1d1d1f]">
                {latestTranscript.text}
              </p>
            </div>
          ) : null}
        </section>
        <AnswerWorkbench
          mode="support"
          initialQuestion={latestTranscript?.text ?? ""}
          autoSource={latestTranscript ? "remote-audio" : "manual"}
          autoGenerate={Boolean(latestTranscript)}
          autoRunId={latestTranscript?.id}
        />
      </div>
    </section>
  );
}
