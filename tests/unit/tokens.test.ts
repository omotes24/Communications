import { describe, expect, it, beforeEach } from "vitest";

import {
  getWalletBalance,
  releaseAiTokenReservation,
  reserveAiTokens,
  resetTestTokenState,
  settleAiTokens,
} from "@/lib/tokens/service";

const userId = "00000000-0000-4000-8000-000000000002";

describe("app token reservations", () => {
  beforeEach(() => {
    process.env.TOKEN_TEST_MODE = "true";
    resetTestTokenState(userId, 1000);
  });

  it("settles actual usage and returns the reservation difference", async () => {
    const reservation = await reserveAiTokens({
      userId,
      requestId: "request-a",
      operationId: "00000000-0000-4000-8000-000000000100",
      feature: "generate-answer",
      provider: "openai",
      model: "gpt-test",
      estimatedAmount: 500,
    });

    await settleAiTokens(reservation, { inputTokens: 10, outputTokens: 10 });
    const wallet = await getWalletBalance(userId);

    expect(wallet.reserved_balance).toBe(0);
    expect(wallet.available_balance).toBeGreaterThan(500);
    expect(wallet.available_balance).toBeLessThan(1000);
  });

  it("does not charge twice for the same request id", async () => {
    await reserveAiTokens({
      userId,
      requestId: "request-duplicate",
      operationId: "00000000-0000-4000-8000-000000000101",
      feature: "classify-question",
      provider: "openai",
      model: "gpt-test",
      estimatedAmount: 200,
    });
    await reserveAiTokens({
      userId,
      requestId: "request-duplicate",
      operationId: "00000000-0000-4000-8000-000000000101",
      feature: "classify-question",
      provider: "openai",
      model: "gpt-test",
      estimatedAmount: 200,
    });

    const wallet = await getWalletBalance(userId);

    expect(wallet.available_balance).toBe(800);
    expect(wallet.reserved_balance).toBe(200);
  });

  it("releases reservations after AI failure", async () => {
    const reservation = await reserveAiTokens({
      userId,
      requestId: "request-release",
      operationId: "00000000-0000-4000-8000-000000000102",
      feature: "research-company",
      provider: "openai",
      model: "gpt-test",
      estimatedAmount: 300,
    });

    await releaseAiTokenReservation(reservation, "test_failure");
    const wallet = await getWalletBalance(userId);

    expect(wallet.available_balance).toBe(1000);
    expect(wallet.reserved_balance).toBe(0);
  });

  it("keeps balance non-negative with more than 10 parallel reservations", async () => {
    resetTestTokenState(userId, 1000);

    const reservations = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        reserveAiTokens({
          userId,
          requestId: `request-parallel-${index}`,
          operationId: "00000000-0000-4000-8000-000000000103",
          feature: "generate-answer",
          provider: "openai",
          model: "gpt-test",
          estimatedAmount: 50,
        }),
      ),
    );
    await Promise.all(
      reservations.map((reservation) =>
        settleAiTokens(reservation, { inputTokens: 5, outputTokens: 5 }),
      ),
    );

    const wallet = await getWalletBalance(userId);

    expect(wallet.available_balance).toBeGreaterThanOrEqual(0);
    expect(wallet.reserved_balance).toBe(0);
  });

  it("models SSE interruption by releasing the reserved amount", async () => {
    const reservation = await reserveAiTokens({
      userId,
      requestId: "request-sse-interrupted",
      operationId: "00000000-0000-4000-8000-000000000104",
      feature: "generate-answer",
      provider: "openai",
      model: "gpt-test",
      estimatedAmount: 400,
    });

    await releaseAiTokenReservation(reservation, "sse_interrupted");

    const wallet = await getWalletBalance(userId);
    expect(wallet.available_balance).toBe(1000);
    expect(wallet.reserved_balance).toBe(0);
  });
});
