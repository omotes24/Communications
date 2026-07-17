import { describe, expect, it } from "vitest";

import { publicRecentPurchases } from "@/lib/admin/public-stats";

describe("administrator statistics privacy boundary", () => {
  it("removes private user identifiers from recent purchases", () => {
    const result = publicRecentPurchases([
      {
        user_id: "private-supabase-user-uuid",
        amount_jpy: 1_000,
        token_amount: 50_000,
        plan_id: "starter",
        livemode: true,
        created_at: "2026-07-18T00:00:00.000Z",
      },
    ]);

    expect(result).toEqual([
      {
        amount_jpy: 1_000,
        token_amount: 50_000,
        plan_id: "starter",
        livemode: true,
        created_at: "2026-07-18T00:00:00.000Z",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("private-supabase-user-uuid");
    expect(JSON.stringify(result)).not.toContain("user_id");
  });
});
