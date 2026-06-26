export type BillingPlan = {
  id: string;
  name: string;
  amountJpy: number;
  tokenAmount: number;
  legacyTokenAmounts?: readonly number[];
  description: string;
  badge?: string;
};

const planInputs = [
  {
    id: "starter",
    name: "Starter",
    amountJpy: 1000,
    tokenAmount: 300000,
    description: "数回の面接だけならこのパック",
  },
  {
    id: "standard",
    name: "Standard",
    amountJpy: 3000,
    tokenAmount: 1000000,
    legacyTokenAmounts: [900000],
    description: "企業研究から面接本番まで使う標準パック",
    badge: "おすすめ",
  },
  {
    id: "intensive",
    name: "Intensive",
    amountJpy: 10000,
    tokenAmount: 4000000,
    legacyTokenAmounts: [3000000],
    description: "複数社の選考や長めの面接対策向け",
  },
] as const;

export const billingPlans: BillingPlan[] = planInputs.map((plan) => ({
  ...plan,
}));

export function getBillingPlan(planId: string): BillingPlan | null {
  return billingPlans.find((plan) => plan.id === planId) ?? null;
}

export function isAllowedTokenAmountForPlan(
  plan: BillingPlan,
  tokenAmount: number,
): boolean {
  return [plan.tokenAmount, ...(plan.legacyTokenAmounts ?? [])].includes(
    tokenAmount,
  );
}

export function formatJpy(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}
