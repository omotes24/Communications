export const remoteTranscriptAutoSubmitDelayMs = 1200;
export const remoteTranscriptQuestionCueDelayMs = 450;
export const remoteTranscriptMinimumAutoSubmitGapMs = 2500;

const minimumTranscriptLength = 8;
const interviewQuestionCuePatterns = [
  /[?？]/,
  /(?:教えて|聞かせて|話して|説明して|伺っても)/,
  /(?:自己紹介|志望動機|ガクチカ|学生時代|経験|実績|強み|弱み|長所|短所|挫折|苦労|研究|リーダー)/,
  /(?:なぜ|どうして|どのよう|どんな|何を|何が|何で|理由|きっかけ)/,
];

export function normalizeTranscriptForSubmit(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function isSubmittableTranscript(text: string): boolean {
  return normalizeTranscriptForSubmit(text).length >= minimumTranscriptLength;
}

export function looksLikeInterviewQuestion(text: string): boolean {
  const normalized = normalizeTranscriptForSubmit(text);
  if (!isSubmittableTranscript(normalized)) {
    return false;
  }
  return interviewQuestionCuePatterns.some((pattern) =>
    pattern.test(normalized),
  );
}

export function createTranscriptSubmitKey(id: string, text: string): string {
  return `${id}:${normalizeTranscriptForSubmit(text)}`;
}
