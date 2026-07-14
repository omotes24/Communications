"use client";

import { useEffect, useMemo, useState } from "react";

const headlineLines = ["面接の前から、", "本番まで、あなたの味方。"] as const;
const typingSpeedMs = 95;
const startDelayMs = 260;

export function TypingHeadline() {
  const totalLength = useMemo(
    () => headlineLines.reduce((total, line) => total + line.length, 0),
    [],
  );
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      const reducedMotionTimer = window.setTimeout(() => {
        setVisibleLength(totalLength);
      }, 0);
      return () => window.clearTimeout(reducedMotionTimer);
    }

    let interval: number | undefined;
    const startTimer = window.setTimeout(() => {
      interval = window.setInterval(() => {
        setVisibleLength((current) => {
          if (current >= totalLength) {
            if (interval) {
              window.clearInterval(interval);
            }
            return current;
          }
          return current + 1;
        });
      }, typingSpeedMs);
    }, startDelayMs);

    return () => {
      window.clearTimeout(startTimer);
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [totalLength]);

  const firstLineLength = headlineLines[0].length;
  const visibleFirstLine = headlineLines[0].slice(
    0,
    Math.min(visibleLength, firstLineLength),
  );
  const visibleSecondLine = headlineLines[1].slice(
    0,
    Math.max(0, visibleLength - firstLineLength),
  );
  const cursorLine = visibleLength < firstLineLength ? 0 : 1;

  return (
    <h1
      aria-label={headlineLines.join(" ")}
      className="relative mx-auto max-w-5xl text-center text-[clamp(1.3rem,7vw,5rem)] font-bold leading-[1.08] tracking-normal text-[#1d1d1f]"
    >
      <span aria-hidden="true" className="invisible block">
        <span className="block whitespace-nowrap">{headlineLines[0]}</span>
        <span className="block whitespace-nowrap">{headlineLines[1]}</span>
      </span>
      <span aria-hidden="true" className="absolute inset-0 block">
        <span className="block min-h-[1em] whitespace-nowrap">
          {visibleFirstLine}
          {cursorLine === 0 ? <span className="typing-cursor" /> : null}
        </span>
        <span className="block min-h-[1em] whitespace-nowrap">
          {visibleSecondLine}
          {cursorLine === 1 ? <span className="typing-cursor" /> : null}
        </span>
      </span>
    </h1>
  );
}
