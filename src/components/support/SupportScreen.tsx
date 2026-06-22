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
  const [selectedTranscript, setSelectedTranscript] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const [questionLocked, setQuestionLocked] = useState(false);
  const [questionCycle, setQuestionCycle] = useState(0);

  function confirmQuestion(text: string) {
    if (questionLocked) {
      return;
    }
    setSelectedTranscript({ id: crypto.randomUUID(), text });
    setQuestionLocked(true);
  }

  function prepareNextQuestion() {
    setQuestionLocked(false);
    setQuestionCycle((current) => current + 1);
  }

  function toggleQuestionGate() {
    if (questionLocked) {
      prepareNextQuestion();
      return;
    }
    setQuestionLocked(true);
  }

  const gateTitle = questionLocked
    ? selectedTranscript
      ? "質問を確定済み"
      : "質問受付を停止中"
    : "質問を受付中";
  const gateDescription = questionLocked
    ? selectedTranscript
      ? "回答中は新しい文字起こしを自動送信しません。GOで次の質問受付を再開します。"
      : "録音は続けたまま、質問の自動確定だけを止めています。GOで受付を再開します。"
    : "相手の質問が見えたら自動または手動で確定し、回答案を作成します。";
  const GateIcon = questionLocked ? Play : Pause;

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
          autoSubmitRemoteFinal={!questionLocked}
          questionLocked={questionLocked}
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
                questionLocked
                  ? "bg-[#0071e3] hover:bg-[#147ce5]"
                  : "bg-[#1d1d1f] hover:bg-neutral-700",
              ].join(" ")}
            >
              <GateIcon className="h-4 w-4" aria-hidden />
              {questionLocked
                ? selectedTranscript
                  ? "GO 次の質問へ"
                  : "GO 受付再開"
                : "STOP 受付停止"}
            </button>
          </div>
          {selectedTranscript ? (
            <div className="mt-4 rounded-2xl bg-[#f5f5f7] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6e6e73]">
                確定した質問
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-[#1d1d1f]">
                {selectedTranscript.text}
              </p>
            </div>
          ) : null}
        </section>
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
