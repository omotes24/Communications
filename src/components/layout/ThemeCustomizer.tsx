"use client";

import { useEffect, useRef, useState } from "react";
import { Moon, Palette, Sun } from "lucide-react";

import {
  appColorModeOptions,
  appColorModeStorageKey,
  appThemeStorageKey,
  defaultAppColorMode,
  isAppColorMode,
  type AppColorMode,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeCustomizer({
  tone = "light",
}: {
  tone?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  const [colorMode, setColorMode] =
    useState<AppColorMode>(defaultAppColorMode);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentColorMode = document.documentElement.dataset.appMode;
    const storedColorMode = window.localStorage.getItem(appColorModeStorageKey);
    const nextColorMode = isAppColorMode(storedColorMode)
      ? storedColorMode
      : isAppColorMode(currentColorMode)
        ? currentColorMode
        : defaultAppColorMode;
    document.documentElement.setAttribute("data-app-theme", "blue");
    window.localStorage.setItem(appThemeStorageKey, "blue");
    document.documentElement.setAttribute("data-app-mode", nextColorMode);
    const frame = window.requestAnimationFrame(() => {
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
          <p className="px-2 text-xs font-semibold leading-5 text-[#6e6e73]">
            アクセントカラーはJobTrackブルーに統一されています。
          </p>
        </div>
      ) : null}
    </div>
  );
}
