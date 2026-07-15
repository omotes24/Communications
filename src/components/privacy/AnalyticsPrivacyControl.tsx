"use client";

import { useEffect, useState } from "react";
import { BarChart3, CheckCircle2, EyeOff } from "lucide-react";

import {
  analyticsDisabledInThisBrowser,
  browserPrivacySignalEnabled,
  setAnalyticsDisabledInThisBrowser,
} from "@/lib/analytics/client-preferences";

export function AnalyticsPrivacyControl() {
  const [disabled, setDisabled] = useState<boolean | null>(null);
  const [privacySignal, setPrivacySignal] = useState(false);
  const collectionEnabled =
    process.env.NEXT_PUBLIC_PRODUCT_ANALYTICS_ENABLED === "true";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPrivacySignal(browserPrivacySignalEnabled());
      setDisabled(analyticsDisabledInThisBrowser());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function update(nextDisabled: boolean) {
    setAnalyticsDisabledInThisBrowser(nextDisabled);
    setDisabled(analyticsDisabledInThisBrowser());
  }

  return (
    <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
          {disabled ? (
            <EyeOff className="h-4.5 w-4.5" aria-hidden />
          ) : (
            <BarChart3 className="h-4.5 w-4.5" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--foreground)]">
            このブラウザのアクセス解析
          </p>
          <p
            className="mt-1 text-xs leading-5 text-[var(--muted)]"
            aria-live="polite"
          >
            {disabled == null
              ? "設定を確認しています。"
              : privacySignal
                ? "ブラウザのDo Not Track / Global Privacy Controlを尊重し、収集しません。"
                : disabled
                  ? "このブラウザでは収集しません。"
                  : collectionEnabled
                    ? "匿名のページビューとタブ単位のセッションを収集します。"
                    : "現在、サイト全体のアクセス収集は停止中です。"}
          </p>
          {disabled != null && !privacySignal ? (
            <button
              type="button"
              onClick={() => update(!disabled)}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-on)] shadow-sm transition hover:bg-[var(--accent-hover)]"
            >
              {disabled ? (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  アクセス解析を有効にする
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4" aria-hidden />
                  このブラウザでは無効にする
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
