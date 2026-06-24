"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";

export function CheckoutButton({ planId }: { planId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Checkoutを開始できませんでした。");
      }
      window.location.assign(data.url);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Checkoutを開始できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CreditCard className="h-4 w-4" aria-hidden />
        {loading ? "Checkout..." : "購入する"}
      </button>
      {error ? (
        <p className="text-xs font-semibold leading-5 text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
