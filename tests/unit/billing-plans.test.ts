import { describe, expect, it } from "vitest";

import {
  billingPlans,
  getBillingPlan,
  TOKEN_MULTIPLIER_PER_JPY,
} from "@/lib/billing/plans";

describe("billing plans", () => {
  it("grants three app tokens per yen", () => {
    expect(TOKEN_MULTIPLIER_PER_JPY).toBe(3);
    for (const plan of billingPlans) {
      expect(plan.tokenAmount).toBe(plan.amountJpy * 3);
    }
  });

  it("finds plans by id", () => {
    expect(getBillingPlan("standard")).toMatchObject({
      id: "standard",
      amountJpy: 3000,
      tokenAmount: 9000,
    });
    expect(getBillingPlan("missing")).toBeNull();
  });
});
