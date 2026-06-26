export const remoteTranscriptAutoSubmitDelayMs = 1200;
export const remoteTranscriptQuestionCueDelayMs = 450;
export const remoteTranscriptMinimumAutoSubmitGapMs = 900;
export const remoteTranscriptDuplicateWindowMs = 15_000;

const minimumTranscriptLength = 8;
const maximumQuestionCandidateLength = 180;
const trailingQuestionContextLength = 28;
const nestedQuestionCueDistance = 14;
const localQuestionIntroLookbackLength = 14;
const directQuestionPatterns = [
  /[?？]/,
  /(?:ですか|ますか|でしょうか|ましたか|ありますか|できますか|なりますか|いましたか)/,
];
const askVerbPatterns = [
  /(?:教えて|聞かせて|話して|説明して|伺っても|お聞かせ|お話し|お伺い|述べて|挙げて)/,
  /(?:お願いします|お願いいたします)/,
];
const reasoningCuePatterns = [
  /(?:なぜ|どうして|どのよう|どんな|何を|何が|何で|理由|きっかけ|どう|なに)/,
  /(?:比べて|比較して|選ばれた|選んだ|志望|応募|入社|貢献|活かせる|活かしたい|生きる|活きる)/,
];
const topicCuePatterns = [
  /(?:自己紹介|自己PR|自己ピーアール|志望動機|ガクチカ|学生時代|経験|実績|強み|弱み|長所|短所)/,
  /(?:挫折|苦労|研究|リーダー|チーム|困難|失敗|成功|学んだこと|取り組み|課題|工夫|役割|成果)/,
  /(?:あなた|ご自身|自身|キャリア|将来|価値観|人材|職種|職|コース|当社|弊社)/,
];
const questionStartPatterns = [
  /(?:他社|競合|同業)[^。！？?？]{0,40}(?:比べて|比較して)/g,
  /(?:その経験|この経験|その強み|この強み|その弱み|この弱み)[^。！？?？]{0,40}(?:どう|活かせる|教えて)/g,
  /(?:なぜ|どうして|どのよう|どんな|何を|何が|何で|理由|きっかけ|どう)/g,
  /(?:自己紹介|自己PR|自己ピーアール|志望動機|ガクチカ|学生時代|経験|実績|強み|弱み|長所|短所)/g,
  /(?:挫折|苦労|研究|リーダー|チーム|困難|失敗|成功|学んだこと|取り組み|課題|工夫|役割|成果)/g,
  /(?:入社|職種|職|コース|当社|弊社|将来|人材)/g,
];
const leadingFillerPattern =
  /^(?:(?:はい|いいよ|よいです|うん|ええ|では|それでは|じゃあ|次に|続いて|まず|最初に|最後に|ありがとうございます|承知しました|ちなみに)[、,\s。]*)+/;
const japaneseCharacterClass = "\u3040-\u30ff\u3400-\u9fff々〆〇ー";
const japaneseInternalSpacePattern = new RegExp(
  `([${japaneseCharacterClass}])\\s+(?=[${japaneseCharacterClass}])`,
  "g",
);
const spaceBeforeJapanesePunctuationPattern = /[\s　]+([、。！？?？])/g;
const spaceAfterJapanesePunctuationPattern = /([、。！？?？])[\s　]+/g;
const localQuestionIntroPattern =
  /(?:では|それでは|じゃあ|次に|続いて|まず|最初に|最後に|ちなみに)/g;
const contextQuestionStartPattern =
  /^(?:その経験|この経験|その強み|この強み|その弱み|この弱み)/;

export function normalizeCommonTranscriptErrors(text: string): string {
  return text
    .replace(/死亡(?=(?:理由|動機))/g, "志望")
    .replace(/死望(?=(?:理由|動機))/g, "志望")
    .replace(/志亡(?=(?:理由|動機))/g, "志望")
    .replace(/死亡(?=(?:して|し|する|職))/g, "志望")
    .replace(/黒\s*(?=した(?:点|ところ)|した地点)/g, "苦労");
}

export function normalizeTranscriptForSubmit(text: string): string {
  return normalizeCommonTranscriptErrors(text)
    .replace(/\s+/g, " ")
    .replace(japaneseInternalSpacePattern, "$1")
    .replace(spaceBeforeJapanesePunctuationPattern, "$1")
    .replace(spaceAfterJapanesePunctuationPattern, "$1")
    .trim();
}

export function isSubmittableTranscript(text: string): boolean {
  return normalizeTranscriptForSubmit(text).length >= minimumTranscriptLength;
}

function hasDirectQuestionCue(text: string): boolean {
  return directQuestionPatterns.some((pattern) => pattern.test(text));
}

function questionCueScore(text: string): number {
  let score = 0;
  if (askVerbPatterns.some((pattern) => pattern.test(text))) {
    score += 2;
  }
  if (reasoningCuePatterns.some((pattern) => pattern.test(text))) {
    score += 2;
  }
  if (topicCuePatterns.some((pattern) => pattern.test(text))) {
    score += 1;
  }
  return score;
}

export function looksLikeInterviewQuestion(text: string): boolean {
  const normalized = normalizeTranscriptForSubmit(text);
  if (!isSubmittableTranscript(normalized)) {
    return false;
  }
  return hasDirectQuestionCue(normalized) || questionCueScore(normalized) >= 3;
}

function trimLeadingFiller(text: string): string {
  return normalizeTranscriptForSubmit(text.replace(leadingFillerPattern, ""));
}

function splitTranscriptIntoSentences(text: string): string[] {
  return normalizeTranscriptForSubmit(text)
    .replace(/([。！？?？])/g, "$1\n")
    .split(/\n+/)
    .map((part) => trimLeadingFiller(part))
    .filter(Boolean);
}

function findRawQuestionStartIndexes(text: string): number[] {
  const indexes = new Set<number>();
  for (const pattern of questionStartPatterns) {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match) {
      indexes.add(match.index);
      match = pattern.exec(text);
    }
  }
  return [...indexes].sort((a, b) => a - b);
}

function findQuestionStartIndexes(text: string): number[] {
  const indexes = findRawQuestionStartIndexes(text);
  const clusteredIndexes: number[] = [];
  for (const index of indexes) {
    const previousIndex = clusteredIndexes[clusteredIndexes.length - 1];
    const isContextQuestionStart = contextQuestionStartPattern.test(
      text.slice(index),
    );
    if (
      !isContextQuestionStart &&
      previousIndex !== undefined &&
      index - previousIndex <= nestedQuestionCueDistance
    ) {
      continue;
    }
    clusteredIndexes.push(index);
  }
  return clusteredIndexes;
}

function findLastQuestionStart(text: string): number {
  const indexes = findQuestionStartIndexes(text);
  return indexes[indexes.length - 1] ?? -1;
}

function findQuestionCandidateStart(text: string, startIndex: number): number {
  if (startIndex <= trailingQuestionContextLength) {
    return 0;
  }

  const windowStart = Math.max(
    0,
    startIndex - localQuestionIntroLookbackLength,
  );
  const localPrefix = text.slice(windowStart, startIndex);
  localQuestionIntroPattern.lastIndex = 0;
  let introMatch = localQuestionIntroPattern.exec(localPrefix);
  let candidateStart = startIndex;
  while (introMatch) {
    candidateStart = windowStart + introMatch.index;
    introMatch = localQuestionIntroPattern.exec(localPrefix);
  }

  return candidateStart;
}

function trimLongQuestionCandidate(text: string): string {
  const candidate = trimLeadingFiller(text);
  if (candidate.length <= maximumQuestionCandidateLength) {
    return candidate;
  }

  const startIndex = findLastQuestionStart(candidate);
  if (startIndex > 0) {
    const candidateStart = findQuestionCandidateStart(candidate, startIndex);
    const refined = trimLeadingFiller(candidate.slice(candidateStart));
    if (refined.length <= maximumQuestionCandidateLength) {
      return refined;
    }
    return refined.slice(0, maximumQuestionCandidateLength).trim();
  }

  const trailingCandidate = candidate.slice(-maximumQuestionCandidateLength);
  const boundaryIndex = trailingCandidate.search(/[、。！？?？\s]/);
  if (boundaryIndex >= 0) {
    return trimLeadingFiller(trailingCandidate.slice(boundaryIndex + 1));
  }
  return trailingCandidate.trim();
}

function createQuestionCandidates(text: string): string[] {
  const candidates: string[] = [];
  const sentences = splitTranscriptIntoSentences(text);
  const targets =
    sentences.length > 0 ? sentences : [normalizeTranscriptForSubmit(text)];

  for (const sentence of targets) {
    candidates.push(sentence);
    for (const startIndex of findQuestionStartIndexes(sentence)) {
      candidates.push(
        trimLeadingFiller(
          sentence.slice(findQuestionCandidateStart(sentence, startIndex)),
        ),
      );
    }
  }

  if (sentences.length <= 1) {
    for (const startIndex of findQuestionStartIndexes(text)) {
      candidates.push(
        trimLeadingFiller(
          text.slice(findQuestionCandidateStart(text, startIndex)),
        ),
      );
    }
  }

  return candidates
    .map(trimLongQuestionCandidate)
    .filter((candidate, index, all) => {
      if (!candidate) {
        return false;
      }
      return all.indexOf(candidate) === index;
    });
}

export function extractLikelyInterviewQuestion(text: string): string {
  const normalized = normalizeTranscriptForSubmit(text);
  if (!isSubmittableTranscript(normalized)) {
    return "";
  }

  const questionCandidate = createQuestionCandidates(normalized)
    .reverse()
    .find((candidate) => looksLikeInterviewQuestion(candidate));

  if (questionCandidate) {
    return questionCandidate;
  }

  return looksLikeInterviewQuestion(normalized)
    ? trimLongQuestionCandidate(normalized)
    : "";
}

export function createTranscriptSubmitKey(id: string, text: string): string {
  return `${id}:${normalizeTranscriptForSubmit(text)}`;
}

export function createTranscriptSubmitFingerprint(text: string): string {
  return trimLeadingFiller(text)
    .toLowerCase()
    .replace(/[、。！？?？\s.,!「」『』（）()[\]{}]/g, "");
}
