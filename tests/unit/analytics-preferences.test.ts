import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  analyticsDisabledInThisBrowser,
  analyticsPreferenceEvent,
  setAnalyticsDisabledInThisBrowser,
} from "@/lib/analytics/client-preferences";

describe("analytics browser preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window.navigator, "doNotTrack", {
      configurable: true,
      value: "0",
    });
    Object.defineProperty(window.navigator, "globalPrivacyControl", {
      configurable: true,
      value: false,
    });
  });

  it("persists opt-out and notifies the collector", () => {
    const listener = vi.fn();
    window.addEventListener(analyticsPreferenceEvent, listener);

    setAnalyticsDisabledInThisBrowser(true);

    expect(analyticsDisabledInThisBrowser()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(analyticsPreferenceEvent, listener);
  });

  it("respects browser Do Not Track even without a stored preference", () => {
    Object.defineProperty(window.navigator, "doNotTrack", {
      configurable: true,
      value: "1",
    });

    expect(analyticsDisabledInThisBrowser()).toBe(true);
  });
});
