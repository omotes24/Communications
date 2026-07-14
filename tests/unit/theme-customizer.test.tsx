import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeCustomizer } from "@/components/layout/ThemeCustomizer";
import { appColorModeStorageKey, appThemeStorageKey } from "@/lib/theme";

const root = document.documentElement;

function openCustomizer() {
  const trigger = screen.getByRole("button", { name: "Customize" });
  fireEvent.click(trigger);
  return trigger;
}

describe("ThemeCustomizer", () => {
  beforeEach(() => {
    window.localStorage.clear();
    root.dataset.appTheme = "blue";
    root.dataset.appMode = "light";
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    window.localStorage.clear();
    root.removeAttribute("data-app-theme");
    root.removeAttribute("data-app-mode");
    vi.unstubAllGlobals();
  });

  it("restores a saved theme on mount instead of replacing it with blue", async () => {
    window.localStorage.setItem(appThemeStorageKey, "purple");
    window.localStorage.setItem(appColorModeStorageKey, "dark");

    render(<ThemeCustomizer />);

    await waitFor(() => {
      expect(root).toHaveAttribute("data-app-theme", "purple");
      expect(root).toHaveAttribute("data-app-mode", "dark");
    });
    expect(window.localStorage.getItem(appThemeStorageKey)).toBe("purple");

    openCustomizer();
    expect(screen.getByRole("radio", { name: "紫" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "ダーク" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("exposes separate color and display-mode radio groups", async () => {
    render(<ThemeCustomizer />);
    openCustomizer();

    const colorGroup = screen.getByRole("radiogroup", {
      name: /アクセントカラー/,
    });
    const modeGroup = screen.getByRole("radiogroup", { name: /表示/ });

    expect(colorGroup).not.toBe(modeGroup);
    expect(colorGroup.getAttribute("aria-label")).not.toBe(
      modeGroup.getAttribute("aria-label"),
    );
    expect(
      within(colorGroup)
        .getAllByRole("radio")
        .map((radio) => radio.textContent),
    ).toEqual(["水色", "紫", "赤", "慶應カラー", "黒"]);
    expect(within(modeGroup).getAllByRole("radio")).toHaveLength(2);
  });

  it("updates the document, storage, and accessible state when a color is selected", async () => {
    render(<ThemeCustomizer />);
    openCustomizer();

    const purple = screen.getByRole("radio", { name: "紫" });
    fireEvent.click(purple);

    await waitFor(() => {
      expect(root).toHaveAttribute("data-app-theme", "purple");
      expect(window.localStorage.getItem(appThemeStorageKey)).toBe("purple");
      expect(purple).toHaveAttribute("aria-checked", "true");
    });
    expect(screen.getByRole("radio", { name: "水色" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("keeps color and display mode independent", async () => {
    window.localStorage.setItem(appThemeStorageKey, "keio");
    window.localStorage.setItem(appColorModeStorageKey, "light");
    root.dataset.appTheme = "keio";

    render(<ThemeCustomizer />);
    openCustomizer();

    fireEvent.click(screen.getByRole("radio", { name: "ダーク" }));
    await waitFor(() => {
      expect(root).toHaveAttribute("data-app-theme", "keio");
      expect(root).toHaveAttribute("data-app-mode", "dark");
    });
    expect(window.localStorage.getItem(appThemeStorageKey)).toBe("keio");
    expect(window.localStorage.getItem(appColorModeStorageKey)).toBe("dark");

    fireEvent.click(screen.getByRole("radio", { name: "赤" }));
    await waitFor(() => {
      expect(root).toHaveAttribute("data-app-theme", "red");
      expect(root).toHaveAttribute("data-app-mode", "dark");
    });
    expect(window.localStorage.getItem(appThemeStorageKey)).toBe("red");
    expect(window.localStorage.getItem(appColorModeStorageKey)).toBe("dark");
  });

  it("closes with Escape and returns focus to the trigger", () => {
    render(<ThemeCustomizer />);
    const trigger = openCustomizer();
    const red = screen.getByRole("radio", { name: "赤" });
    red.focus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("radio", { name: "赤" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
