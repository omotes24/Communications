import {
  groupDiscussionSessionRecordSchema,
  type GroupDiscussionSessionRecord,
} from "@/lib/schemas/groupDiscussion";

const groupDiscussionStorageKey =
  "jp-interview-assistant:group-discussion:v1";

export function loadLocalGroupDiscussionSessions(): GroupDiscussionSessionRecord[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(groupDiscussionStorageKey);
  if (!raw) {
    return [];
  }
  const parsed: unknown = JSON.parse(raw);
  return groupDiscussionSessionRecordSchema
    .array()
    .catch([])
    .parse(parsed);
}

function writeLocalGroupDiscussionSessions(
  sessions: GroupDiscussionSessionRecord[],
): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    groupDiscussionStorageKey,
    JSON.stringify(sessions.slice(0, 50)),
  );
}

export function saveLocalGroupDiscussionSession(
  session: GroupDiscussionSessionRecord,
): GroupDiscussionSessionRecord[] {
  const current = loadLocalGroupDiscussionSessions();
  const next = current.some((item) => item.id === session.id)
    ? current.map((item) => (item.id === session.id ? session : item))
    : [session, ...current];
  writeLocalGroupDiscussionSessions(next);
  return next.slice(0, 50);
}

export function deleteLocalGroupDiscussionSession(
  id: string,
): GroupDiscussionSessionRecord[] {
  const next = loadLocalGroupDiscussionSessions().filter(
    (session) => session.id !== id,
  );
  writeLocalGroupDiscussionSessions(next);
  return next;
}
