import { describe, expect, it } from "vitest";

import { adjustTextReservationForModel } from "@/lib/tokens/model-rates";

describe("model-specific token rates", () => {
  it("scales Luna reservations against the Sol-based margin card", () => {
    expect(adjustTextReservationForModel("gpt-5.6-luna", 10)).toBe(2);
  });

  it("keeps Luna reservations at least one token", () => {
    expect(adjustTextReservationForModel("gpt-5.6-luna", 1)).toBe(1);
  });

  it("scales Terra reservations against the Sol-based margin card", () => {
    expect(adjustTextReservationForModel("gpt-5.6-terra", 10)).toBe(5);
  });

  it("recognizes dated model snapshots", () => {
    expect(adjustTextReservationForModel("gpt-5.6-luna-2026-07-15", 10)).toBe(
      2,
    );
  });

  it("uses the conservative nano output ratio", () => {
    expect(adjustTextReservationForModel("gpt-5.4-nano", 240)).toBe(10);
  });

  it("does not scale other models", () => {
    expect(adjustTextReservationForModel("gpt-5.6-sol", 10)).toBe(10);
  });
});
