"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MessageSquareText,
  RotateCcw,
  Target,
  Trash2,
} from "lucide-react";

import { GroupDiscussionMapView } from "@/components/group-discussion/GroupDiscussionMapView";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  deleteLocalGroupDiscussionSession,
  loadLocalGroupDiscussionSessions,
  saveLocalGroupDiscussionSession,
} from "@/lib/group-discussion/local-store";
import type {
  GDEvaluationScore,
  GroupDiscussionSessionRecord,
} from "@/lib/schemas/groupDiscussion";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import { cn } from "@/lib/utils";

const scoreLabels: Record<keyof GDEvaluationScore, string> = {
  issue_definition: "論点定義・前提確認",
  logical_thinking: "論理性・構造化",
  contribution: "議論貢献度",
  collaboration: "協調性・巻き込み",
  listening_summary: "傾聴・要約",
  decision_making: "意思決定・収束力",
  time_management: "時間管理",
  output_quality: "結論品質",
  presentation: "発表力",
  company_fit: "企業/職種との相性",
};

function scoreTone(score: number): string {
  if (score >= 4) {
    return "bg-emerald-50 text-emerald-900";
  }
  if (score >= 3) {
    return "bg-amber-50 text-amber-900";
  }
  return "bg-rose-50 text-rose-900";
}

function passLabel(value: "high" | "medium" | "low") {
  if (value === "high") {
    return "高め";
  }
  if (value === "medium") {
    return "中程度";
  }
  return "低め";
}

export function GroupDiscussionResultScreen({
  sessionId,
}: {
  sessionId: string;
}) {
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

  const session = useMemo(
    () =>
      storage.groupDiscussionSessions.find((item) => item.id === sessionId) ??
      localSessions.find((item) => item.id === sessionId) ??
      null,
    [localSessions, sessionId, storage.groupDiscussionSessions],
  );

  function retrySameTheme(base: GroupDiscussionSessionRecord) {
    const now = new Date().toISOString();
    const next: GroupDiscussionSessionRecord = {
      ...base,
      id: crypto.randomUUID(),
      status: "active",
      utterances: [],
      discussionMap: {
        nodes: [
          {
            id: "topic",
            type: "topic",
            label: base.topic,
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

  function retryWeaknessDrill(base: GroupDiscussionSessionRecord, drill: string) {
    const now = new Date().toISOString();
    const topic = `${drill}：${base.topic}`;
    const next: GroupDiscussionSessionRecord = {
      ...base,
      id: crypto.randomUUID(),
      mode: "solo",
      practiceMode: "one_person_drill",
      status: "active",
      topic,
      durationMinutes: 10,
      participants: base.participants.filter(
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
            label: topic,
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
  const scores = evaluation?.scores;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="GD採点レポート"
        description="発言ログに基づいて、通過可能性の目安、強み、改善点、次の練習を確認します。"
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => retrySameTheme(session)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1d1d1f] px-4 text-sm font-semibold text-white"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            同じテーマで再挑戦
          </button>
          <Link
            href="/group-discussion"
            className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#1d1d1f] shadow-sm ring-1 ring-black/[0.06]"
          >
            別テーマで再挑戦
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
      </div>

      <section className="rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          Session
        </p>
        <p className="mt-4 text-base font-semibold leading-7 text-[#6e6e73]">
          {session.topic}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <ScoreSummary
            label="総合点"
            value={evaluation ? `${evaluation.totalScore}` : "-"}
          />
          <ScoreSummary
            label="通過可能性の目安"
            value={evaluation ? passLabel(evaluation.passPossibility) : "-"}
          />
          <ScoreSummary
            label="発話数"
            value={`${session.utterances.filter((item) => item.speakerType === "user").length}`}
          />
          <ScoreSummary
            label="モード"
            value={
              session.practiceMode === "one_person_drill"
                ? "1人練習"
                : session.practiceMode === "pressure"
                  ? "高難度"
                  : session.practiceMode === "guided"
                    ? "初心者向け"
                    : "本番形式"
            }
          />
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
            セッションで採点を作る
          </Link>
        )}
      </section>

      {scores ? (
        <section className="grid gap-3 rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
          <h2 className="text-xl font-semibold">評価項目</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {Object.entries(scores).map(([key, score]) => {
              if (typeof score !== "number") {
                return null;
              }
              const scoreKey = key as keyof GDEvaluationScore;
              return (
                <article
                  key={key}
                  className={cn("rounded-3xl p-4", scoreTone(score))}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold">
                      {scoreLabels[scoreKey]}
                    </h3>
                    <p className="text-3xl font-semibold">{score}</p>
                  </div>
                  <p className="mt-1 text-xs font-semibold opacity-70">5点満点</p>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {evaluation ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <ListCard title="強みトップ3" items={evaluation.strengths} />
            <ListCard title="改善点トップ3" items={evaluation.weaknesses} />
            <ListCard title="次回の具体アクション" items={evaluation.nextActions} />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
              <h2 className="text-xl font-semibold">発言ログからの根拠</h2>
              <div className="mt-4 grid gap-3">
                {evaluation.evidence.map((item, index) => (
                  <article
                    key={`${item.relatedScoreKey}-${index}`}
                    className="rounded-3xl bg-[#f5f5f7] p-4"
                  >
                    <p className="text-xs font-semibold text-[#86868b]">
                      {scoreLabels[item.relatedScoreKey]}
                    </p>
                    <blockquote className="mt-2 text-sm font-semibold leading-6">
                      「{item.quote}」
                    </blockquote>
                    <p className="mt-2 text-sm font-medium leading-6 text-[#6e6e73]">
                      {item.comment}
                    </p>
                  </article>
                ))}
              </div>
            </div>
            <div className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
              <h2 className="text-xl font-semibold">言い換え例</h2>
              <div className="mt-4 grid gap-3">
                {evaluation.improvedPhrases.map((item) => (
                  <article
                    key={`${item.original}-${item.improved}`}
                    className="rounded-3xl bg-[#f5f5f7] p-4"
                  >
                    <p className="text-xs font-semibold text-[#86868b]">
                      改善前
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6">
                      {item.original}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-[#86868b]">
                      改善後
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6">
                      {item.improved}
                    </p>
                    <p className="mt-3 text-xs font-semibold leading-5 text-[#6e6e73]">
                      {item.reason}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.6fr)]">
            <div className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
              <h2 className="text-xl font-semibold">2分発表の改善版</h2>
              <p className="mt-4 rounded-3xl bg-[#f5f5f7] p-5 text-base font-semibold leading-8">
                {evaluation.improvedPresentation}
              </p>
            </div>
            <div className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
              <h2 className="inline-flex items-center gap-2 text-xl font-semibold">
                <Target className="h-5 w-5" aria-hidden />
                次にやるミニドリル
              </h2>
              <div className="mt-4 grid gap-2">
                {evaluation.recommendedDrills.map((drill) => (
                  <button
                    type="button"
                    key={drill}
                    onClick={() => retryWeaknessDrill(session, drill)}
                    className="rounded-2xl bg-[#f5f5f7] p-3 text-left text-sm font-semibold transition hover:bg-white hover:ring-1 hover:ring-black/[0.08]"
                  >
                    {drill}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}

      <section className="rounded-[30px] bg-[#f5f5f7] p-5 shadow-sm ring-1 ring-black/[0.06]">
        <GroupDiscussionMapView map={session.discussionMap} />
      </section>

      <section className="grid gap-3 rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <MessageSquareText className="h-5 w-5" aria-hidden />
          発言ログと行動タグ
        </h2>
        {session.utterances.map((utterance) => (
          <div key={utterance.id} className="rounded-3xl bg-[#f5f5f7] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-[#6e6e73]">
                {utterance.speakerName}
              </p>
              {(utterance.analysis?.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#6e6e73]"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-2 text-sm font-semibold leading-6">
              {utterance.text}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}

function ScoreSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-[#f5f5f7] p-4">
      <p className="text-xs font-semibold text-[#6e6e73]">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 grid gap-2">
        {items.slice(0, 3).map((item) => (
          <p
            key={item}
            className="rounded-2xl bg-[#f5f5f7] p-3 text-sm font-semibold leading-6"
          >
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
