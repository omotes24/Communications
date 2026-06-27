"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquareText, RotateCcw, Target, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import {
  deleteLocalGroupDiscussionSession,
  loadLocalGroupDiscussionSessions,
  saveLocalGroupDiscussionSession,
} from "@/lib/group-discussion/local-store";
import type { GroupDiscussionSessionRecord } from "@/lib/schemas/groupDiscussion";
import { useAppStorage } from "@/lib/storage/use-app-storage";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function scoreDeltaLabel(
  session: GroupDiscussionSessionRecord,
  sessions: GroupDiscussionSessionRecord[],
): string | null {
  const currentScore = session.finalEvaluation?.totalScore;
  if (typeof currentScore !== "number") {
    return null;
  }
  const currentTime = new Date(session.createdAt).getTime();
  const previous = sessions
    .filter(
      (item) =>
        item.id !== session.id &&
        item.topic === session.topic &&
        typeof item.finalEvaluation?.totalScore === "number" &&
        new Date(item.createdAt).getTime() < currentTime,
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
  const previousScore = previous?.finalEvaluation?.totalScore;
  if (typeof previousScore !== "number") {
    return null;
  }
  const delta = currentScore - previousScore;
  if (delta === 0) {
    return "前回比 ±0";
  }
  return `前回比 ${delta > 0 ? "+" : ""}${delta}`;
}

export function GroupDiscussionHistoryScreen() {
  const router = useRouter();
  const { ready, storage, actions } = useAppStorage();
  const [localSessions, setLocalSessions] = useState<
    GroupDiscussionSessionRecord[]
  >([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setLocalSessions(loadLocalGroupDiscussionSessions());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const sessions = useMemo(() => {
    const byId = new Map<string, GroupDiscussionSessionRecord>();
    for (const session of localSessions) {
      byId.set(session.id, session);
    }
    for (const session of storage.groupDiscussionSessions) {
      byId.set(session.id, session);
    }
    return Array.from(byId.values()).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [localSessions, storage.groupDiscussionSessions]);

  function retrySameTheme(session: GroupDiscussionSessionRecord) {
    const now = new Date().toISOString();
    const next: GroupDiscussionSessionRecord = {
      ...session,
      id: crypto.randomUUID(),
      status: "active",
      utterances: [],
      discussionMap: {
        nodes: [
          {
            id: "topic",
            type: "topic",
            label: session.topic,
            evidenceUtteranceIds: [],
          },
        ],
        edges: [],
      },
      metrics: null,
      finalEvaluation: null,
      currentPhase: "intro",
      phaseHistory: [{ phase: "intro", startedAt: now, endedAt: null }],
      whiteboardNotes: "",
      finalAnswer: "",
      presentationText: "",
      createdAt: now,
      startedAt: now,
      endedAt: null,
      updatedAt: now,
    };
    actions.saveGroupDiscussionSession(next);
    setLocalSessions(saveLocalGroupDiscussionSession(next));
    router.push(`/group-discussion/session/${next.id}`);
  }

  function retryWeaknessDrill(session: GroupDiscussionSessionRecord) {
    const drill = (session.recommendedDrills ?? [])[0];
    if (!drill) {
      retrySameTheme(session);
      return;
    }
    const now = new Date().toISOString();
    const next: GroupDiscussionSessionRecord = {
      ...session,
      id: crypto.randomUUID(),
      mode: "solo",
      practiceMode: "one_person_drill",
      status: "active",
      topic: `${drill}：${session.topic}`,
      durationMinutes: 10,
      participants: session.participants.filter(
        (participant) => participant.type === "user",
      ),
      aiParticipantCount: 0,
      aiPersonas: [],
      utterances: [],
      discussionMap: {
        nodes: [
          {
            id: "topic",
            type: "topic",
            label: `${drill}：${session.topic}`,
            evidenceUtteranceIds: [],
          },
        ],
        edges: [],
      },
      metrics: null,
      finalEvaluation: null,
      currentPhase: "intro",
      phaseHistory: [{ phase: "intro", startedAt: now, endedAt: null }],
      whiteboardNotes: "",
      finalAnswer: "",
      presentationText: "",
      recommendedDrills: [],
      createdAt: now,
      startedAt: now,
      endedAt: null,
      updatedAt: now,
    };
    actions.saveGroupDiscussionSession(next);
    setLocalSessions(saveLocalGroupDiscussionSession(next));
    router.push(`/group-discussion/session/${next.id}`);
  }

  return (
    <div className="grid gap-5">
      <Link
        href="/group-discussion"
        className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#1d1d1f] shadow-sm ring-1 ring-black/[0.06]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        GD練習へ戻る
      </Link>
      <PageHeader
        title="GD練習履歴"
        description="保存したグループディスカッション練習の結果を再表示できます。"
        compact
      />

      {!ready ? (
        <div className="rounded-[30px] bg-white p-8 text-center font-semibold shadow-sm ring-1 ring-black/[0.06]">
          読み込み中...
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-[30px] bg-white p-8 text-center shadow-sm ring-1 ring-black/[0.06]">
          <MessageSquareText className="mx-auto h-8 w-8 text-[#86868b]" />
          <h2 className="mt-4 text-xl font-semibold">履歴はまだありません</h2>
          <p className="mt-2 text-sm font-medium text-[#6e6e73]">
            練習を終了すると、評価結果がここに保存されます。
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sessions.map((session) => (
            <article
              key={session.id}
              className="grid gap-4 rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06] md:grid-cols-[minmax(0,1fr)_auto]"
            >
              <Link href={`/group-discussion/result/${session.id}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                  {session.status === "completed" ? "Completed" : "Active"} /{" "}
                  {formatDate(session.createdAt)}
                </p>
                <h2 className="mt-3 text-xl font-semibold leading-8">
                  {session.topic}
                </h2>
                <p className="mt-2 text-sm font-medium text-[#6e6e73]">
                  {session.utterances.length}発話 /{" "}
                  {session.finalEvaluation
                    ? `総合${session.finalEvaluation.totalScore}`
                    : "評価未作成"}
                </p>
                {scoreDeltaLabel(session, sessions) ? (
                  <p className="mt-2 text-xs font-semibold text-[var(--accent)]">
                    {scoreDeltaLabel(session, sessions)}
                  </p>
                ) : null}
                {(session.recommendedDrills ?? []).length > 0 ? (
                  <p className="mt-2 text-xs font-semibold text-[#86868b]">
                    次ドリル: {session.recommendedDrills[0]}
                  </p>
                ) : null}
              </Link>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => retrySameTheme(session)}
                  className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-[#1d1d1f] px-4 text-sm font-semibold text-white"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  同じテーマ
                </button>
                {(session.recommendedDrills ?? []).length > 0 ? (
                  <button
                    type="button"
                    onClick={() => retryWeaknessDrill(session)}
                    className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#1d1d1f] ring-1 ring-black/[0.08]"
                  >
                    <Target className="h-4 w-4" aria-hidden />
                    弱点ドリル
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    actions.deleteGroupDiscussionSession(session.id);
                    setLocalSessions(deleteLocalGroupDiscussionSession(session.id));
                  }}
                  className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-red-50 px-4 text-sm font-semibold text-red-700"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  削除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
