import { describe, expect, it } from "vitest";

import { billingPlans, getBillingPlan } from "@/lib/billing/plans";

describe("billing plans", () => {
  it("uses fixed token grants for each purchase plan", () => {
    expect(billingPlans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "starter",
          amountJpy: 1000,
          tokenAmount: 300000,
        }),
        expect.objectContaining({
          id: "standard",
          amountJpy: 3000,
          tokenAmount: 1000000,
        }),
        expect.objectContaining({
          id: "intensive",
          amountJpy: 10000,
          tokenAmount: 4000000,
        }),
      ]),
    );
  });

  it("finds plans by id", () => {
    expect(getBillingPlan("standard")).toMatchObject({
      id: "standard",
      amountJpy: 3000,
      tokenAmount: 1000000,
    });
    expect(getBillingPlan("missing")).toBeNull();
  });
});
