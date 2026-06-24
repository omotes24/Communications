export type BillingPlan = {
  id: string;
  name: string;
  amountJpy: number;
  tokenAmount: number;
  description: string;
  badge?: string;
};

export const TOKEN_MULTIPLIER_PER_JPY = 300;

const planInputs = [
  {
    id: "starter",
    name: "Starter",
    amountJpy: 1000,
    description: "軽い面接準備や動作確認向け",
  },
  {
    id: "standard",
    name: "Standard",
    amountJpy: 3000,
    description: "企業研究から面接本番まで使う標準パック",
    badge: "おすすめ",
  },
  {
    id: "intensive",
    name: "Intensive",
    amountJpy: 10000,
    description: "複数社の選考や長めの面接対策向け",
  },
] as const;

export const billingPlans: BillingPlan[] = planInputs.map((plan) => ({
  ...plan,
  tokenAmount: plan.amountJpy * TOKEN_MULTIPLIER_PER_JPY,
}));

export function getBillingPlan(planId: string): BillingPlan | null {
  return billingPlans.find((plan) => plan.id === planId) ?? null;
}

export function formatJpy(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}
