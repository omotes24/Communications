import { describe, expect, it } from "vitest";

import { adjustAnswerReservationForModel } from "@/lib/tokens/model-rates";

describe("model-specific token rates", () => {
  it("scales Luna reservations from the previous mini-model rate", () => {
    expect(adjustAnswerReservationForModel("gpt-5.6-luna", 9)).toBe(4);
  });

  it("keeps Luna reservations at least one token", () => {
    expect(adjustAnswerReservationForModel("gpt-5.6-luna", 1)).toBe(1);
  });

  it("does not scale other models", () => {
    expect(adjustAnswerReservationForModel("gpt-5.6-terra", 9)).toBe(9);
  });
});
