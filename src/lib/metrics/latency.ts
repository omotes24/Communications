export type LatencyMetric =
  | "speechEndedAt"
  | "finalTranscriptAt"
  | "classificationDoneAt"
  | "firstTalkingPointAt"
  | "firstAnswerTokenAt"
  | "answerDoneAt";

export type LatencyMarks = Partial<Record<LatencyMetric, number>>;

export function markLatency(
  marks: LatencyMarks,
  metric: LatencyMetric,
): LatencyMarks {
  return { ...marks, [metric]: performance.now() };
}

export function elapsedBetween(
  marks: LatencyMarks,
  start: LatencyMetric,
  end: LatencyMetric,
): number | null {
  if (marks[start] == null || marks[end] == null) {
    return null;
  }
  return Math.round(marks[end] - marks[start]);
}
