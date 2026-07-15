export const analyticsDisabledStorageKey = "yfy.analytics-disabled";
export const analyticsPreferenceEvent = "yfy:analytics-preference-changed";

type NavigatorWithPrivacySignals = Navigator & {
  globalPrivacyControl?: boolean;
};

export function browserPrivacySignalEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  const current = navigator as NavigatorWithPrivacySignals;
  return current.globalPrivacyControl === true || current.doNotTrack === "1";
}

export function analyticsDisabledInThisBrowser(): boolean {
  if (typeof window === "undefined") return false;
  if (browserPrivacySignalEnabled()) return true;
  try {
    return window.localStorage.getItem(analyticsDisabledStorageKey) === "true";
  } catch {
    return true;
  }
}

export function setAnalyticsDisabledInThisBrowser(disabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (disabled) {
      window.localStorage.setItem(analyticsDisabledStorageKey, "true");
    } else {
      window.localStorage.removeItem(analyticsDisabledStorageKey);
    }
  } catch {
    return;
  }
  window.dispatchEvent(new Event(analyticsPreferenceEvent));
}
