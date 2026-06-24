"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";

import {
  appThemeOptions,
  appThemeStorageKey,
  defaultAppTheme,
  isAppTheme,
  type AppTheme,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeCustomizer() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(defaultAppTheme);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentTheme = document.documentElement.dataset.appTheme;
    const storedTheme = window.localStorage.getItem(appThemeStorageKey);
    const nextTheme = isAppTheme(storedTheme)
      ? storedTheme
      : isAppTheme(currentTheme)
        ? currentTheme
        : defaultAppTheme;
    document.documentElement.setAttribute("data-app-theme", nextTheme);
    const frame = window.requestAnimationFrame(() => {
      setTheme(nextTheme);
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="theme-customizer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6e6e73] transition hover:text-[#1d1d1f]"
      >
        <Palette className="h-3.5 w-3.5" aria-hidden />
        Customize
      </button>

      {open ? (
        <div
          id="theme-customizer"
          className="absolute bottom-full left-0 z-30 mb-3 w-[18.5rem] rounded-[24px] bg-white p-3 shadow-lg ring-1 ring-black/[0.08]"
        >
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
