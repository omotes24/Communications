"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Moon, Palette, Sun } from "lucide-react";

import {
  appColorModeOptions,
  appColorModeStorageKey,
  appThemeOptions,
  appThemeStorageKey,
  defaultAppColorMode,
  defaultAppTheme,
  isAppColorMode,
  isAppTheme,
  type AppColorMode,
  type AppTheme,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeCustomizer({
  tone = "light",
}: {
  tone?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(defaultAppTheme);
  const [colorMode, setColorMode] = useState<AppColorMode>(defaultAppColorMode);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const colorModeButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const themeButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const currentTheme = document.documentElement.dataset.appTheme;
    const currentColorMode = document.documentElement.dataset.appMode;
    let storedTheme: string | null = null;
    let storedColorMode: string | null = null;
    try {
      storedTheme = window.localStorage.getItem(appThemeStorageKey);
      storedColorMode = window.localStorage.getItem(appColorModeStorageKey);
    } catch {}
    const nextTheme = isAppTheme(storedTheme)
      ? storedTheme
      : isAppTheme(currentTheme)
        ? currentTheme
        : defaultAppTheme;
    const nextColorMode = isAppColorMode(storedColorMode)
      ? storedColorMode
      : isAppColorMode(currentColorMode)
        ? currentColorMode
        : defaultAppColorMode;
    document.documentElement.setAttribute("data-app-theme", nextTheme);
    document.documentElement.setAttribute("data-app-mode", nextColorMode);
    const frame = window.requestAnimationFrame(() => {
      setTheme(nextTheme);
      setColorMode(nextColorMode);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function selectTheme(nextTheme: AppTheme) {
    document.documentElement.setAttribute("data-app-theme", nextTheme);
    try {
      window.localStorage.setItem(appThemeStorageKey, nextTheme);
    } catch {}
    setTheme(nextTheme);
  }

  function selectColorMode(nextColorMode: AppColorMode) {
    document.documentElement.setAttribute("data-app-mode", nextColorMode);
    try {
      window.localStorage.setItem(appColorModeStorageKey, nextColorMode);
    } catch {}
    setColorMode(nextColorMode);
  }

  function handleColorModeKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const nextIndex = nextRadioIndex(
      event.key,
      index,
      appColorModeOptions.length,
    );
    if (nextIndex === null) return;
    event.preventDefault();
    selectColorMode(appColorModeOptions[nextIndex].id);
    colorModeButtonRefs.current[nextIndex]?.focus();
  }

  function handleThemeKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const nextIndex = nextRadioIndex(event.key, index, appThemeOptions.length);
    if (nextIndex === null) return;
    event.preventDefault();
    selectTheme(appThemeOptions[nextIndex].id);
    themeButtonRefs.current[nextIndex]?.focus();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="theme-customizer"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg text-xs font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent-ring-strong)]",
          tone === "dark"
            ? "text-white/50 hover:text-white"
            : "text-[#6e6e73] hover:text-[#1d1d1f]",
        )}
      >
        <Palette className="h-3.5 w-3.5" aria-hidden />
        Customize
      </button>

      {open ? (
        <div
          id="theme-customizer"
          className={cn(
            "fixed inset-x-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-[22rem] rounded-[24px] p-3 shadow-lg ring-1 sm:absolute sm:inset-x-auto sm:bottom-full sm:left-auto sm:right-0 sm:mb-3 sm:w-[22rem]",
            colorMode === "dark"
              ? "bg-neutral-950 text-white ring-white/10"
              : "bg-white text-[#1d1d1f] ring-black/[0.08]",
          )}
        >
          <div
            className={cn(
              "mb-3 grid grid-cols-2 gap-2 rounded-full p-1",
              colorMode === "dark" ? "bg-white/10" : "bg-[#f5f5f7]",
            )}
            role="radiogroup"
            aria-label="表示モード"
          >
            {appColorModeOptions.map((option, index) => {
              const selected = option.id === colorMode;
              const Icon = option.id === "dark" ? Moon : Sun;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  ref={(node) => {
                    colorModeButtonRefs.current[index] = node;
                  }}
                  onClick={() => selectColorMode(option.id)}
                  onKeyDown={(event) => handleColorModeKeyDown(event, index)}
                  className={cn(
                    "flex h-9 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent-ring-strong)]",
                    selected
                      ? colorMode === "dark"
                        ? "bg-[var(--foreground)] text-[var(--background)] shadow-sm"
                        : "bg-[#1d1d1f] text-white shadow-sm"
                      : colorMode === "dark"
                        ? "text-white/60 hover:bg-white/10 hover:text-white"
                        : "text-[#6e6e73] hover:bg-white hover:text-[#1d1d1f]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mb-2 px-1 text-[11px] font-semibold text-[#6e6e73]">
            アクセントカラー
          </p>
          <div
            className="grid grid-cols-5 gap-1.5"
            role="radiogroup"
            aria-label="アクセントカラー"
          >
            {appThemeOptions.map((option, index) => {
              const selected = option.id === theme;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  ref={(node) => {
                    themeButtonRefs.current[index] = node;
                  }}
                  onClick={() => selectTheme(option.id)}
                  onKeyDown={(event) => handleThemeKeyDown(event, index)}
                  className={cn(
                    "flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[9px] font-semibold leading-3 transition hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent-ring-strong)]",
                    colorMode === "dark" && "hover:bg-white/10",
                    selected &&
                      (colorMode === "dark"
                        ? "bg-white/10 ring-2 ring-white/30"
                        : "bg-[#f5f5f7] ring-2 ring-black/10"),
                  )}
                >
                  <span
                    className="relative flex h-9 w-9 items-center justify-center rounded-full border border-black/10 shadow-sm"
                    style={{ background: option.swatch }}
                    aria-hidden
                  >
                    {selected ? (
                      <Check className="h-4 w-4 text-white drop-shadow" />
                    ) : null}
                  </span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-[10px] leading-4 text-[#86868b]">
            選択内容はこのブラウザに保存されます。
          </p>
        </div>
      ) : null}
    </div>
  );
}

function nextRadioIndex(
  key: string,
  currentIndex: number,
  itemCount: number,
): number | null {
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  if (key === "ArrowRight" || key === "ArrowDown") {
    return (currentIndex + 1) % itemCount;
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return (currentIndex - 1 + itemCount) % itemCount;
  }
  return null;
}
