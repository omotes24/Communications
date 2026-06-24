import type { TranscriptItem } from "@/components/audio/use-realtime-transcription";
import {
  normalizeCommonTranscriptErrors,
  normalizeTranscriptForSubmit,
} from "@/components/audio/transcript-auto-submit";

const mergeWindowMs = 45_000;
const sentenceEndPattern = /[。！？?？.!]$/;
const repeatedJapanesePhrasePattern =
  /([\u3040-\u30ff\u3400-\u9fff]{2,6})\1/g;

function endsWithSentenceBoundary(text: string): boolean {
  return sentenceEndPattern.test(normalizeTranscriptForSubmit(text));
}

function normalizeMergedTranscript(text: string): string {
  return normalizeCommonTranscriptErrors(
    text.replace(repeatedJapanesePhrasePattern, "$1"),
  )
    .split("\n")
    .map((line) => normalizeTranscriptForSubmit(line))
    .filter(Boolean)
    .join("\n");
}

function joinTranscriptText(previous: string, next: string): string {
  const previousText = normalizeMergedTranscript(previous);
  const previousCompactText = normalizeTranscriptForSubmit(previous);
  const nextText = normalizeTranscriptForSubmit(next);
  const maxOverlap = Math.min(previousCompactText.length, nextText.length, 16);
  let overlap = 0;
  for (let length = maxOverlap; length >= 2; length -= 1) {
    if (previousCompactText.endsWith(nextText.slice(0, length))) {
      overlap = length;
      break;
    }
  }
  const separator =
    overlap > 0 ? "" : endsWithSentenceBoundary(previousText) ? "\n" : " ";
  return normalizeMergedTranscript(
    `${previousText}${separator}${nextText.slice(overlap)}`,
  );
}

function shouldMergeTranscriptItems(
  previous: TranscriptItem,
  next: TranscriptItem,
): boolean {
  if (previous.source !== next.source) {
    return false;
  }
  if (!previous.final || !next.final) {
    return false;
  }
  if (!previous.text.trim() || !next.text.trim()) {
    return false;
  }
  if (next.createdAt - previous.createdAt > mergeWindowMs) {
    return false;
  }
  return true;
}

export function mergeTranscriptItemsForReading(
  items: TranscriptItem[],
): TranscriptItem[] {
  const chronologicalItems = items
    .slice()
    .sort((left, right) => left.createdAt - right.createdAt);
  const mergedItems: TranscriptItem[] = [];

  for (const item of chronologicalItems) {
    const previous = mergedItems.at(-1);
    if (previous && shouldMergeTranscriptItems(previous, item)) {
      mergedItems[mergedItems.length - 1] = {
        ...previous,
        id: `${previous.id}:${item.id}`,
        text: joinTranscriptText(previous.text, item.text),
        final: previous.final && item.final,
      };
      continue;
    }
    mergedItems.push(item);
  }

  return mergedItems;
}

export function formatTranscriptItemsForReading(items: TranscriptItem[]): string {
  return mergeTranscriptItemsForReading(items)
    .map((item) => {
      const speaker = item.source === "remote" ? "相手側" : "自分側";
      return `${speaker}\n${item.text}`;
    })
    .join("\n\n")
    .trim();
}
