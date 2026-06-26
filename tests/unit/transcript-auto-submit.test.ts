import { describe, expect, it } from "vitest";

import {
  createTranscriptSubmitFingerprint,
  createTranscriptSubmitKey,
  extractLikelyInterviewQuestion,
  isSubmittableTranscript,
  looksCompleteInterviewQuestion,
  looksLikeInterviewQuestion,
  normalizeTranscriptForSubmit,
  remoteTranscriptAutoSubmitDelayMs,
  remoteTranscriptDuplicateWindowMs,
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
      "自己紹介からお願いします",
    );
    expect(isSubmittableTranscript("はい")).toBe(false);
    expect(isSubmittableTranscript("自己紹介をお願いします")).toBe(true);
  });

  it("removes unnatural spaces inside Japanese transcripts", () => {
    expect(
      normalizeTranscriptForSubmit(
        "では 自己紹介を 分程度でお願いします。 学生時代最も この力を入れたことは何ですか? AI いや機械学習の研究 で 最も黒 した地点は何ですか? なぜ 技術職を死亡しているの ですか?",
      ),
    ).toBe(
      "では自己紹介を分程度でお願いします。学生時代最もこの力を入れたことは何ですか?AI いや機械学習の研究で最も苦労した地点は何ですか?なぜ技術職を志望しているのですか?",
    );
    expect(normalizeTranscriptForSubmit("脂肪動機を教えてください。")).toBe(
      "志望動機を教えてください。",
    );
  });

  it("uses text content in the submit key so extended partials can resubmit", () => {
    expect(createTranscriptSubmitKey("pending", "自己紹介")).not.toBe(
      createTranscriptSubmitKey("pending", "自己紹介をお願いします"),
    );
    expect(
      createTranscriptSubmitFingerprint("では 自己紹介をお願いします。"),
    ).toBe(createTranscriptSubmitFingerprint("自己紹介をお願いします"));
    expect(remoteTranscriptDuplicateWindowMs).toBe(15_000);
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
    expect(
      looksLikeInterviewQuestion(
        "なぜエンジニア職ではなくビジネス職を志望しているのですか",
      ),
    ).toBe(true);
    expect(
      looksLikeInterviewQuestion(
        "当社であなたの強みがどう生きるか教えてください",
      ),
    ).toBe(true);
    expect(looksLikeInterviewQuestion("志望動機を教えてください。")).toBe(
      true,
    );
    expect(looksCompleteInterviewQuestion("脂肪動機を教えてください。")).toBe(
      true,
    );
    expect(
      looksLikeInterviewQuestion(
        "日本にある次の数を推定してみてください",
      ),
    ).toBe(true);
    expect(looksLikeInterviewQuestion("本日はよろしくお願いいたします。")).toBe(
      false,
    );
    expect(looksCompleteInterviewQuestion("どのような工夫をして")).toBe(false);
    expect(
      looksCompleteInterviewQuestion(
        "どのような工夫をして生徒さんを集めましたか?",
      ),
    ).toBe(true);
    expect(
      looksLikeInterviewQuestion("質問をもうちょっと簡潔にしてください"),
    ).toBe(false);
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

  it("extracts the question from long unpunctuated interviewer speech", () => {
    expect(
      extractLikelyInterviewQuestion(
        "本日はよろしくお願いします 今日は研究内容や学生時代の経験について順番に伺います まず最初に簡単な自己紹介からお願いします",
      ),
    ).toBe("簡単な自己紹介からお願いします");
    expect(
      extractLikelyInterviewQuestion(
        "ここまでの説明はよく分かりました 研究ではデータの扱いや分析の工夫が多かったと思いますが その経験を当社でどう活かせると思いますか",
      ),
    ).toBe("その経験を当社でどう活かせると思いますか");
  });

  it("keeps the subject when a long question contains internal cue words", () => {
    expect(
      extractLikelyInterviewQuestion(
        "ありがとうございます 続いてあなたの弱みとそれをどう改善しているかを教えてください",
      ),
    ).toBe("あなたの弱みとそれをどう改善しているかを教えてください");
  });

  it("does not include the candidate answer after an earlier detected question", () => {
    expect(
      extractLikelyInterviewQuestion(
        "では自己紹介をお願いします。はい、表紘太朗と申します。慶應義塾大学で機械学習の研究をしています。",
      ),
    ).toBe("自己紹介をお願いします。");
  });

  it("ignores meta speech and extracts the latest complete question", () => {
    expect(
      normalizeTranscriptForSubmit(
        "学生時代に取り組んだ経験を教えてください。ください",
      ),
    ).toBe("学生時代に取り組んだ経験を教えてください。");
    expect(
      extractLikelyInterviewQuestion(
        "同じ質問でいい では学生時代中チームで取り組んだ経験を教えてください。ください トリガーワード ああ では塾事業を新しく始めるに当たって最初の生徒さんを確保する上でどのような工夫をして生徒さんを集めましたか? あれ? 質問もちょっともうちょっと簡潔に MCテーマで推定してください。時間は5分差し上げます。ごめん、もう一回言うわ。はいでは日本にある次の数を推定してみてください。考える時間は5分差し上げます。",
      ),
    ).toBe("日本にある次の数を推定してみてください。");
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
      "面白いですね。あなたの弱みを教えてください。",
    ]);
    expect(extractLikelyInterviewQuestion(merged[0]?.text ?? "")).toBe(
      "あなたの弱みを教えてください。",
    );
    expect(formatTranscriptItemsForReading(merged)).toBe(
      "面白いですね。あなたの弱みを教えてください。",
    );
  });
});
