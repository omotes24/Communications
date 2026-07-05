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
  const [colorMode, setColorMode] =
    useState<AppColorMode>(defaultAppColorMode);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentTheme = document.documentElement.dataset.appTheme;
    const storedTheme = window.localStorage.getItem(appThemeStorageKey);
    const currentColorMode = document.documentElement.dataset.appMode;
    const storedColorMode = window.localStorage.getItem(appColorModeStorageKey);
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
    window.localStorage.setItem(appThemeStorageKey, nextTheme);
    setTheme(nextTheme);
  }

  function selectColorMode(nextColorMode: AppColorMode) {
    document.documentElement.setAttribute("data-app-mode", nextColorMode);
    window.localStorage.setItem(appColorModeStorageKey, nextColorMode);
    setColorMode(nextColorMode);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="theme-customizer"
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium transition",
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
            "absolute bottom-full left-0 z-30 mb-3 w-[18.5rem] rounded-[24px] p-3 shadow-lg ring-1",
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
            aria-label="表示テーマ"
          >
            {appColorModeOptions.map((option) => {
              const selected = option.id === colorMode;
              const Icon = option.id === "dark" ? Moon : Sun;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => selectColorMode(option.id)}
                  className={cn(
                    "flex h-9 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition",
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
          <div
            className="grid grid-cols-7 gap-2"
            role="radiogroup"
            aria-label="Theme color"
          >
            {appThemeOptions.map((option) => {
              const selected = option.id === theme;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${option.label}テーマ`}
                  onClick={() => selectTheme(option.id)}
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full border border-black/10 shadow-sm transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-[var(--accent-ring-strong)]",
                    selected ? "ring-4 ring-[var(--accent-ring)]" : "",
                  )}
                  style={{ backgroundColor: option.color }}
                >
                  {selected ? (
                    <Check className="h-4 w-4 text-white" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
