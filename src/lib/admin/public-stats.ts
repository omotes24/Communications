import "server-only";

export type PrivatePurchaseRow = {
  user_id: string;
  amount_jpy: number;
  token_amount: number;
  plan_id: string;
  livemode: boolean;
  created_at: string;
};

export function publicRecentPurchases(
  purchases: PrivatePurchaseRow[],
  limit = 10,
) {
  return purchases.slice(0, limit).map((purchase) => ({
    amount_jpy: purchase.amount_jpy,
    token_amount: purchase.token_amount,
    plan_id: purchase.plan_id,
    livemode: purchase.livemode,
    created_at: purchase.created_at,
  }));
}
