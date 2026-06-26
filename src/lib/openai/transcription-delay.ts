export const realtimeTranscriptionDelays = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

export type RealtimeTranscriptionDelay =
  (typeof realtimeTranscriptionDelays)[number];

export function isRealtimeTranscriptionDelay(
  value: unknown,
): value is RealtimeTranscriptionDelay {
  return (
    typeof value === "string" &&
    realtimeTranscriptionDelays.includes(value as RealtimeTranscriptionDelay)
  );
}
