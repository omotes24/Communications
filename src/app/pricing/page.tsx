import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  billingPlans,
  formatJpy,
  TOKEN_MULTIPLIER_PER_JPY,
} from "@/lib/billing/plans";

export default function PricingPage() {
  return (
    <AppShell>
      <PageHeader
        title="Pricing"
        description={`支払額1円につき${TOKEN_MULTIPLIER_PER_JPY} tokensを付与します。購入はStripe Checkoutで処理されます。`}
      />

      <section className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-3">
          {billingPlans.map((plan) => (
            <article
              key={plan.id}
              className="flex min-h-[310px] flex-col rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#6e6e73]">
                    {plan.name}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight">
                    {formatJpy(plan.amountJpy)}
                  </p>
                </div>
                {plan.badge ? (
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    {plan.badge}
                  </span>
                ) : null}
              </div>

              <div className="mt-5 rounded-2xl bg-[#f5f5f7] p-4">
                <p className="text-xs font-semibold text-[#6e6e73]">付与</p>
                <p className="mt-1 text-2xl font-semibold">
                  {plan.tokenAmount.toLocaleString()} tokens
                </p>
              </div>

              <p className="mt-4 min-h-[48px] text-sm font-medium leading-6 text-[#6e6e73]">
                {plan.description}
              </p>

              <div className="mt-auto pt-5">
                <CheckoutButton planId={plan.id} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
