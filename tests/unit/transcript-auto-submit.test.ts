import { describe, expect, it } from "vitest";

import {
  createTranscriptSubmitKey,
  extractLikelyInterviewQuestion,
  isSubmittableTranscript,
  looksLikeInterviewQuestion,
  normalizeTranscriptForSubmit,
  remoteTranscriptAutoSubmitDelayMs,
  remoteTranscriptMinimumAutoSubmitGapMs,
  remoteTranscriptQuestionCueDelayMs,
} from "@/components/audio/transcript-auto-submit";
import {
  formatTranscriptItemsForReading,
  mergeTranscriptItemsForReading,
} from "@/components/audio/transcript-items";

describe("transcript auto submit helpers", () => {
  it("normalizes and filters tiny partial transcripts", () => {
    expect(normalizeTranscriptForSubmit("  自己紹介から\nお願いします  ")).toBe(
      "自己紹介から お願いします",
    );
    expect(isSubmittableTranscript("はい")).toBe(false);
    expect(isSubmittableTranscript("自己紹介をお願いします")).toBe(true);
  });

  it("uses text content in the submit key so extended partials can resubmit", () => {
    expect(createTranscriptSubmitKey("pending", "自己紹介")).not.toBe(
      createTranscriptSubmitKey("pending", "自己紹介をお願いします"),
    );
    expect(remoteTranscriptAutoSubmitDelayMs).toBeLessThanOrEqual(1500);
  });

  it("detects interview question cues before the transcript is finalized", () => {
    expect(
      looksLikeInterviewQuestion("ではまず簡単な自己紹介からお願いします。"),
    ).toBe(true);
    expect(looksLikeInterviewQuestion("本日はよろしくお願いいたします。")).toBe(
      false,
    );
    expect(remoteTranscriptQuestionCueDelayMs).toBeLessThanOrEqual(500);
  });

  it("detects common Japanese interview question variations", () => {
    expect(
      looksLikeInterviewQuestion(
        "他社の企業と比べてなぜ弊社を選ばれたのですか?",
      ),
    ).toBe(true);
    expect(
      looksLikeInterviewQuestion("学生時代に力を入れたことを教えてください"),
    ).toBe(true);
    expect(
      looksLikeInterviewQuestion("研究で工夫した点について聞かせてください"),
    ).toBe(true);
    expect(looksLikeInterviewQuestion("本日はよろしくお願いいたします。")).toBe(
      false,
    );
    expect(remoteTranscriptMinimumAutoSubmitGapMs).toBeLessThanOrEqual(1000);
  });

  it("extracts the latest question segment from noisy interviewer text", () => {
    expect(
      extractLikelyInterviewQuestion(
        "ありがとうございます。続いて、他社の企業と比べてなぜ弊社を選ばれたのですか?",
      ),
    ).toBe("他社の企業と比べてなぜ弊社を選ばれたのですか?");
    expect(
      extractLikelyInterviewQuestion(
        "では面接を始めます。まず簡単な自己紹介からお願いします。",
      ),
    ).toBe("簡単な自己紹介からお願いします。");
    expect(
      extractLikelyInterviewQuestion(
        "はい、ありがとうございます。承知しました。",
      ),
    ).toBe("");
  });

  it("merges adjacent finalized transcript fragments for reading", () => {
    const merged = mergeTranscriptItemsForReading([
      {
        id: "3",
        source: "remote",
        text: "弱み弱みを教えてください。",
        final: true,
        createdAt: 3000,
      },
      {
        id: "2",
        source: "remote",
        text: "あなたの",
        final: true,
        createdAt: 2000,
      },
      {
        id: "1",
        source: "remote",
        text: "面白いですね。",
        final: true,
        createdAt: 1000,
      },
    ]);

    expect(merged.map((item) => item.text)).toEqual([
      "面白いですね。\nあなたの 弱みを教えてください。",
    ]);
    expect(extractLikelyInterviewQuestion(merged[0]?.text ?? "")).toBe(
      "あなたの 弱みを教えてください。",
    );
    expect(formatTranscriptItemsForReading(merged)).toBe(
      "相手側\n面白いですね。\nあなたの 弱みを教えてください。",
    );
  });
});
