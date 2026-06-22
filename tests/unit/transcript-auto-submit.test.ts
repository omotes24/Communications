import { describe, expect, it } from "vitest";

import {
  createTranscriptSubmitKey,
  isSubmittableTranscript,
  looksLikeInterviewQuestion,
  normalizeTranscriptForSubmit,
  remoteTranscriptAutoSubmitDelayMs,
  remoteTranscriptQuestionCueDelayMs,
} from "@/components/audio/transcript-auto-submit";

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
});
