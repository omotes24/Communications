import { describe, expect, it } from "vitest";

import {
  appThemeOptions,
  defaultAppTheme,
  isAppTheme,
  resolveAppTheme,
} from "@/lib/theme";

describe("app theme", () => {
  it("offers the five supported accent colors with blue as the default", () => {
    expect(appThemeOptions.map((option) => option.id)).toEqual([
      "blue",
      "purple",
      "red",
      "keio",
      "black",
    ]);
    expect(appThemeOptions.map((option) => option.label)).toEqual([
      "水色",
      "紫",
      "赤",
      "慶應カラー",
      "黒",
    ]);
    expect(defaultAppTheme).toBe("blue");
  });

  it.each(["blue", "purple", "red", "keio", "black"])(
    "accepts the supported %s theme",
    (theme) => {
      expect(isAppTheme(theme)).toBe(true);
      expect(resolveAppTheme(theme)).toBe(theme);
    },
  );

  it.each([null, undefined, "", "orange", "green", "pink", "unknown"])(
    "falls back to blue for an invalid or legacy value: %s",
    (theme) => {
      expect(isAppTheme(theme)).toBe(false);
      expect(resolveAppTheme(theme)).toBe("blue");
    },
  );
});
