"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { AnswerWorkbench } from "@/components/answer/AnswerWorkbench";
import { AudioCapturePanel } from "@/components/audio/AudioCapturePanel";
import { PageHeader } from "@/components/layout/PageHeader";

export function SupportScreen() {
  const [consent, setConsent] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<{
    id: string;
    text: string;
  } | null>(null);

  return (
    <section>
      <PageHeader
        title="同意済み会話支援"
        description="参加者全員がAI支援を認識し、必要な同意を得ている会話でだけ使います。自動音声回答、自動入力、隠し表示はありません。"
      />
      <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-4">
        <label className="flex items-start gap-3 text-sm font-medium text-emerald-950">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>参加者へAI支援利用を明示し、必要な同意を得ています。</span>
        </label>
      </div>
      {!consent ? (
        <div className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600">
          上の確認を完了すると、音声入力と回答案作成を開始できます。
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-white p-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            AI支援利用中であることを常時表示しています。
          </div>
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
      )}
    </section>
  );
}
