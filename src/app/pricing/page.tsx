import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { getCurrentUser } from "@/lib/auth/server";
import { billingPlans, formatJpy } from "@/lib/billing/plans";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const user = await getCurrentUser();
  const isLoggedIn = Boolean(user);

  return (
    <AppShell>
      <PageHeader title="課金" />

      <section className="grid gap-5">
        {!isLoggedIn ? (
          <div className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
            <p className="text-sm font-semibold leading-6 text-[#1d1d1f]">
              トークン購入にはログインが必要です。
            </p>
            <p className="mt-2 text-sm font-medium leading-6 text-[#6e6e73]">
              ログイン後、購入したトークンはログイン中のアカウントに反映されます。
            </p>
            <Link
              href="/auth/login?next=/pricing"
              className="mt-4 inline-flex h-11 items-center rounded-full bg-[#1d1d1f] px-5 text-sm font-semibold text-white"
            >
              ログインして購入へ
            </Link>
          </div>
        ) : null}

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
                {isLoggedIn ? (
                  <CheckoutButton planId={plan.id} />
                ) : (
                  <Link
                    href="/auth/login?next=/pricing"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-[#1d1d1f] px-4 text-sm font-semibold text-white"
                  >
                    ログインして購入
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
