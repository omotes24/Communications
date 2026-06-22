"use client";

import { useEffect, useMemo, useState } from "react";

const headlineLines = ["面接準備を", "会社ごとに整える。"] as const;
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
      className="relative mx-auto max-w-5xl text-center text-5xl font-semibold tracking-normal text-[#1d1d1f] sm:text-7xl lg:text-8xl"
    >
      <span aria-hidden="true" className="invisible block">
        {headlineLines[0]}
        <br />
        {headlineLines[1]}
      </span>
      <span aria-hidden="true" className="absolute inset-0 block">
        <span className="block min-h-[1em]">
          {visibleFirstLine}
          {cursorLine === 0 ? <span className="typing-cursor" /> : null}
        </span>
        <span className="block min-h-[1em]">
          {visibleSecondLine}
          {cursorLine === 1 ? <span className="typing-cursor" /> : null}
        </span>
      </span>
    </h1>
  );
}
