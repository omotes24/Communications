import { describe, expect, it } from "vitest";

import { mockClassifyQuestion } from "@/lib/test/mock-openai";

describe("mock OpenAI behavior", () => {
  it("does not trigger generation for local speech", () => {
    const result = mockClassifyQuestion({
      transcript: "経験について教えてください",
      speaker: "local",
      source: "local-mic",
    });

    expect(result.isQuestion).toBe(false);
  });

  it("classifies answer requests as questions", () => {
    const result = mockClassifyQuestion({
      transcript: "これまでの経験について教えてください",
      speaker: "remote",
      source: "remote-audio",
    });

    expect(result.isQuestion).toBe(true);
    expect(result.category).toBe("experience");
  });
});
