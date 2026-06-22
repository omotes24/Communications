import type { AnswerDraft } from "@/lib/schemas/interview";

function unescapeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value.replace(/"$/, "")}"`) as string;
  } catch {
    return value
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\");
  }
}

function readStringField(buffer: string, key: string): string | undefined {
  const keyIndex = buffer.indexOf(`"${key}"`);
  if (keyIndex < 0) {
    return undefined;
  }
  const colonIndex = buffer.indexOf(":", keyIndex);
  if (colonIndex < 0) {
    return undefined;
  }
  const start = buffer.indexOf('"', colonIndex + 1);
  if (start < 0) {
    return undefined;
  }
  let escaped = false;
  for (let index = start + 1; index < buffer.length; index += 1) {
    const char = buffer[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      return unescapeJsonString(buffer.slice(start + 1, index));
    }
  }
  return unescapeJsonString(buffer.slice(start + 1));
}

function readStringArrayField(
  buffer: string,
  key: string,
): string[] | undefined {
  const keyIndex = buffer.indexOf(`"${key}"`);
  if (keyIndex < 0) {
    return undefined;
  }
  const openIndex = buffer.indexOf("[", keyIndex);
  if (openIndex < 0) {
    return undefined;
  }
  const values: string[] = [];
  let index = openIndex + 1;
  while (index < buffer.length) {
    while (/[\s,]/.test(buffer[index] ?? "")) {
      index += 1;
    }
    if (buffer[index] === "]") {
      return values;
    }
    if (buffer[index] !== '"') {
      return values.length ? values : undefined;
    }
    const start = index + 1;
    let escaped = false;
    for (index = start; index < buffer.length; index += 1) {
      const char = buffer[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        values.push(unescapeJsonString(buffer.slice(start, index)));
        index += 1;
        break;
      }
    }
    if (index >= buffer.length) {
      return values;
    }
  }
  return values.length ? values : undefined;
}

export function extractPartialAnswer(buffer: string): Partial<AnswerDraft> {
  return {
    question: readStringField(buffer, "question"),
    talkingPoints: readStringArrayField(buffer, "talkingPoints"),
    answer: readStringField(buffer, "answer"),
    evidenceUsed: readStringArrayField(buffer, "evidenceUsed"),
    missingInformation: readStringArrayField(buffer, "missingInformation"),
  };
}
