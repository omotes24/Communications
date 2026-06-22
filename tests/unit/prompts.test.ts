import { describe, expect, it } from "vitest";

import { buildAnswerInstructions } from "@/lib/prompts/answer";
import { buildQuestionClassifierInput } from "@/lib/prompts/classifier";

describe("prompts", () => {
  it("contains anti-fabrication rules", () => {
    const prompt = buildAnswerInstructions();
    expect(prompt).toContain("創作しない");
    expect(prompt).toContain("根拠がない場合");
    expect(prompt).toContain("evidenceUsed");
  });

  it("marks local speech in classifier input", () => {
    const input = buildQuestionClassifierInput({
      transcript: "私の回答です",
      speaker: "local",
      source: "local-mic",
    });
    expect(input).toContain("speaker: local");
  });
});
