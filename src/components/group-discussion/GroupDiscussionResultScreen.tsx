"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MessageSquareText, RotateCcw, Trash2 } from "lucide-react";

import { GroupDiscussionMapView } from "@/components/group-discussion/GroupDiscussionMapView";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  deleteLocalGroupDiscussionSession,
  loadLocalGroupDiscussionSessions,
} from "@/lib/group-discussion/local-store";
import type { GroupDiscussionSessionRecord } from "@/lib/schemas/groupDiscussion";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import { cn } from "@/lib/utils";

const metricKeys = [
  "speakingTimeSeconds",
  "utteranceCount",
  "questionCount",
  "connectionToOthers",
  "discussionProgress",
  "issueOrganization",
  "interruptionRisk",
  "conclusionContribution",
  "timeManagement",
] as const;

function findEvidence(session: GroupDiscussionSessionRecord, ids: string[]) {
  return ids
    .map((id) => session.utterances.find((utterance) => utterance.id === id))
    .filter((utterance): utterance is GroupDiscussionSessionRecord["utterances"][number] =>
      Boolean(utterance),
    );
}

function scoreClassName(score: number): string {
  if (score >= 75) {
    return "bg-emerald-50 text-emerald-900";
  }
  if (score >= 45) {
    return "bg-amber-50 text-amber-900";
  }
  return "bg-rose-50 text-rose-900";
}

export function GroupDiscussionResultScreen({
  sessionId,
}: {
  sessionId: string;
}) {
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
  const session = useMemo(
    () =>
      storage.groupDiscussionSessions.find((item) => item.id === sessionId) ??
      localSessions.find((item) => item.id === sessionId) ??
      null,
    [localSessions, sessionId, storage.groupDiscussionSessions],
  );

  if (!ready) {
    return (
      <div className="rounded-[30px] bg-white p-8 text-center font-semibold shadow-sm ring-1 ring-black/[0.06]">
        読み込み中...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="grid gap-4 rounded-[30px] bg-white p-8 shadow-sm ring-1 ring-black/[0.06]">
        <h1 className="text-2xl font-semibold">結果が見つかりません</h1>
        <Link
          href="/group-discussion"
          className="inline-flex h-11 w-fit items-center rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white"
        >
          GD練習へ戻る
        </Link>
      </div>
    );
  }

  const evaluation = session.finalEvaluation;
  const metrics = session.metrics;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="GD結果"
        description="発話ログに基づいて、発言量・質問・論点整理・結論形成を振り返ります。"
        dense
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/group-discussion"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#1d1d1f] shadow-sm ring-1 ring-black/[0.06]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          戻る
        </Link>
        <button
          type="button"
          onClick={() => {
            actions.deleteGroupDiscussionSession(session.id);
            setLocalSessions(deleteLocalGroupDiscussionSession(session.id));
          }}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-red-50 px-4 text-sm font-semibold text-red-700"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          削除
        </button>
      </div>

      <section className="rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          Session
        </p>
        <p className="mt-4 text-base font-semibold leading-7 text-[#6e6e73]">
          {session.topic}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl bg-[#f5f5f7] p-4">
            <p className="text-xs font-semibold text-[#6e6e73]">総合スコア</p>
            <p className="mt-2 text-4xl font-semibold">
              {evaluation?.totalScore ?? "-"}
            </p>
          </div>
          <div className="rounded-3xl bg-[#f5f5f7] p-4">
            <p className="text-xs font-semibold text-[#6e6e73]">発話数</p>
            <p className="mt-2 text-4xl font-semibold">
              {session.utterances.filter((item) => item.speakerType === "user").length}
            </p>
          </div>
          <div className="rounded-3xl bg-[#f5f5f7] p-4">
            <p className="text-xs font-semibold text-[#6e6e73]">モード</p>
            <p className="mt-2 text-xl font-semibold">
              {session.mode === "ai-participants" ? "AI参加者付き" : "1人練習"}
            </p>
          </div>
        </div>
        {evaluation ? (
          <p className="mt-5 rounded-3xl bg-[#f5f5f7] p-5 text-base font-semibold leading-8 text-[#1d1d1f]">
            {evaluation.summary}
          </p>
        ) : (
          <Link
            href={`/group-discussion/session/${session.id}`}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-[#1d1d1f] px-5 text-sm font-semibold text-white"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            セッションで評価を作る
          </Link>
        )}
      </section>

      {metrics ? (
        <section className="grid gap-3 rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
          <h2 className="text-xl font-semibold">評価項目</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {metricKeys.map((key) => {
              const metric = metrics[key];
              const evidence = findEvidence(
                session,
                metric.evidenceUtteranceIds,
              );
              return (
                <article
                  key={key}
                  className={cn("rounded-3xl p-4", scoreClassName(metric.score))}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold">{metric.label}</h3>
                    <p className="text-2xl font-semibold">{metric.score}</p>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-6">
                    {metric.comment}
                  </p>
                  {evidence.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {evidence.slice(0, 2).map((utterance) => (
                        <p
                          key={utterance.id}
                          className="rounded-2xl bg-white/70 p-2 text-xs font-semibold leading-5"
                        >
                          {utterance.text}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs font-semibold opacity-70">
                      根拠発話なし
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {evaluation ? (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
            <h2 className="text-xl font-semibold">強み</h2>
            <div className="mt-4 grid gap-3">
              {evaluation.strengths.map((item) => (
                <article key={item.title} className="rounded-3xl bg-[#f5f5f7] p-4">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#6e6e73]">
                    {item.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>
          <div className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
            <h2 className="text-xl font-semibold">次に直すこと</h2>
            <div className="mt-4 grid gap-3">
              {evaluation.improvements.map((item) => (
                <article key={item.title} className="rounded-3xl bg-[#f5f5f7] p-4">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#6e6e73]">
                    {item.detail}
                  </p>
                  <p className="mt-3 rounded-2xl bg-white p-3 text-sm font-semibold leading-6">
                    {item.nextAction}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[30px] bg-[#f5f5f7] p-5 shadow-sm ring-1 ring-black/[0.06]">
        <GroupDiscussionMapView map={session.discussionMap} />
      </section>

      <section className="grid gap-3 rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <MessageSquareText className="h-5 w-5" aria-hidden />
          発話ログ
        </h2>
        {session.utterances.map((utterance) => (
          <div key={utterance.id} className="rounded-3xl bg-[#f5f5f7] p-4">
            <p className="text-xs font-semibold text-[#6e6e73]">
              {utterance.speakerName} / {utterance.id}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6">
              {utterance.text}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
