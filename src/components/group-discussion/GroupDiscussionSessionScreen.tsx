"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Mic,
  Send,
  Timer,
  Trophy,
  UserRound,
} from "lucide-react";

import { AudioCapturePanel } from "@/components/audio/AudioCapturePanel";
import type { TranscriptItem } from "@/components/audio/use-realtime-transcription";
import { GroupDiscussionMapView } from "@/components/group-discussion/GroupDiscussionMapView";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  analyzeGroupDiscussionUtterance,
  gdPhaseLabels,
  refreshGroupDiscussionSessionAnalysis,
} from "@/lib/group-discussion/analysis";
import {
  loadLocalGroupDiscussionSessions,
  saveLocalGroupDiscussionSession,
} from "@/lib/group-discussion/local-store";
import { createMockFinalEvaluation } from "@/lib/group-discussion/mock";
import {
  gdPhaseSchema,
  groupDiscussionAiTurnOutputSchema,
  groupDiscussionFinalizeOutputSchema,
  type GDPhase,
  type GroupDiscussionSessionRecord,
  type GroupDiscussionUtterance,
} from "@/lib/schemas/groupDiscussion";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import { cn } from "@/lib/utils";

const phaseOrder: GDPhase[] = [
  "intro",
  "define",
  "diverge",
  "analyze",
  "converge",
  "present",
  "review",
];

function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function elapsedSeconds(session: GroupDiscussionSessionRecord, now: number) {
  if (!session.startedAt) {
    return 0;
  }
  const end = session.endedAt ? new Date(session.endedAt).getTime() : now;
  return Math.max(
    0,
    Math.floor((end - new Date(session.startedAt).getTime()) / 1000),
  );
}

function remainingSeconds(session: GroupDiscussionSessionRecord, now: number) {
  return Math.max(0, session.durationMinutes * 60 - elapsedSeconds(session, now));
}

function createUserUtterance({
  sessionId,
  text,
  source,
}: {
  sessionId: string;
  text: string;
  source: GroupDiscussionUtterance["source"];
}): GroupDiscussionUtterance {
  const now = new Date().toISOString();
  return {
    id: `gd-user-${crypto.randomUUID()}`,
    sessionId,
    speakerId: "user",
    speakerName: "あなた",
    speakerType: "user",
    text,
    source,
    startedAt: now,
    endedAt: now,
    durationSeconds: Math.max(2, Math.ceil(text.length / 9)),
    analysis: analyzeGroupDiscussionUtterance({ text }),
  };
}

function appendUtterance(
  session: GroupDiscussionSessionRecord,
  utterance: GroupDiscussionUtterance,
): GroupDiscussionSessionRecord {
  return refreshGroupDiscussionSessionAnalysis({
    ...session,
    utterances: [...session.utterances, utterance],
    updatedAt: new Date().toISOString(),
  });
}

function phaseHint(phase: GDPhase) {
  switch (phase) {
    case "intro":
      return "役割、前提、制限時間を短く確認します。";
    case "define":
      return "言葉の定義とゴールを揃えます。";
    case "diverge":
      return "案を広げます。否定せず、選択肢を増やします。";
    case "analyze":
      return "評価基準に沿って比較します。";
    case "converge":
      return "結論案を一つに絞ります。理由と懸念も添えます。";
    case "present":
      return "2分発表として、結論、理由、実行手順をまとめます。";
    case "review":
      return "採点と振り返りを確認します。";
  }
}

function buildPresentationDraft(session: GroupDiscussionSessionRecord) {
  const conclusion = session.finalAnswer.trim();
  if (conclusion) {
    return `結論として、${conclusion.replace(/^結論として、?/, "")}。理由は、今回のテーマでは効果だけでなく、実現性とリスクを同時に見る必要があるからです。まず短期で検証できる施策から実行し、結果を見て次の打ち手に広げる進め方がよいと考えます。`;
  }
  return `結論として、今回のテーマ「${session.topic}」では、効果・実現性・リスクの3点で比較し、短期で検証しやすい施策を優先すべきだと考えます。まず対象者と課題を絞り、3か月以内に検証できる案から始めることで、実行可能性のある結論になります。`;
}

function tagsForDisplay(utterance: GroupDiscussionUtterance) {
  return utterance.analysis?.tags.slice(0, 4) ?? [];
}

export function GroupDiscussionSessionScreen({
  sessionId,
}: {
  sessionId: string;
}) {
  const { ready, storage, actions } = useAppStorage();
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [localSessions, setLocalSessions] = useState<
    GroupDiscussionSessionRecord[]
  >([]);
  const handledTranscriptIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setLocalSessions(loadLocalGroupDiscussionSessions());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const session = useMemo(
    () =>
      storage.groupDiscussionSessions.find((item) => item.id === sessionId) ??
      localSessions.find((item) => item.id === sessionId) ??
      null,
    [localSessions, sessionId, storage.groupDiscussionSessions],
  );

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (!session || session.status !== "active" || session.utterances.length === 0) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [session]);

  function saveSession(next: GroupDiscussionSessionRecord) {
    actions.saveGroupDiscussionSession(next);
    setLocalSessions(saveLocalGroupDiscussionSession(next));
  }

  function patchSession(
    current: GroupDiscussionSessionRecord,
    patch: Partial<GroupDiscussionSessionRecord>,
  ) {
    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    saveSession(next);
    return next;
  }

  async function requestAiTurn(baseSession: GroupDiscussionSessionRecord) {
    if (baseSession.mode !== "ai-participants") {
      return;
    }
    setAiBusy(true);
    try {
      const response = await fetch("/api/group-discussion/ai-turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": crypto.randomUUID(),
          "x-operation-id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          session: baseSession,
          currentPhase: baseSession.currentPhase,
          remainingSeconds: remainingSeconds(baseSession, Date.now()),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data && typeof data === "object" && "error" in data
            ? String(data.error)
            : "AI参加者の発言生成に失敗しました。",
        );
      }
      const parsed = groupDiscussionAiTurnOutputSchema.parse(data);
      saveSession(appendUtterance(baseSession, parsed.utterance));
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "AI参加者の発言生成に失敗しました。",
      );
    } finally {
      setAiBusy(false);
    }
  }

  function addUserText(text: string, source: GroupDiscussionUtterance["source"]) {
    if (!session) {
      return null;
    }
    const normalized = text.trim();
    if (!normalized) {
      return null;
    }
    const next = appendUtterance(
      session,
      createUserUtterance({ sessionId: session.id, text: normalized, source }),
    );
    saveSession(next);
    return next;
  }

  async function submitManual() {
    const next = addUserText(draft, "text");
    if (!next) {
      return;
    }
    setDraft("");
    setStatus(null);
    await requestAiTurn(next);
  }

  function handleTranscriptItems(items: TranscriptItem[]) {
    const finals = items
      .filter((item) => item.final && item.text.trim())
      .sort((a, b) => a.createdAt - b.createdAt);
    for (const item of finals) {
      if (handledTranscriptIdsRef.current.has(item.id)) {
        continue;
      }
      handledTranscriptIdsRef.current.add(item.id);
      const next = addUserText(
        item.text,
        item.source === "remote" ? "tab-audio" : "microphone",
      );
      if (next?.mode === "ai-participants") {
        void requestAiTurn(next);
      }
    }
  }

  function advancePhase() {
    if (!session) {
      return;
    }
    const currentIndex = phaseOrder.indexOf(session.currentPhase);
    const nextPhase = phaseOrder[Math.min(phaseOrder.length - 1, currentIndex + 1)];
    if (!gdPhaseSchema.safeParse(nextPhase).success) {
      return;
    }
    const changedAt = new Date().toISOString();
    patchSession(session, {
      currentPhase: nextPhase,
      phaseHistory: [
        ...session.phaseHistory.map((item, index) =>
          index === session.phaseHistory.length - 1 && !item.endedAt
            ? { ...item, endedAt: changedAt }
            : item,
        ),
        { phase: nextPhase, startedAt: changedAt, endedAt: null },
      ],
    });
  }

  async function endSession() {
    if (!session || session.utterances.length === 0) {
      setStatus("発話を1件以上追加してから終了してください。");
      return;
    }
    setEnding(true);
    setStatus("採点レポートを作成しています。発言ログは保持しています。");
    const endedSession: GroupDiscussionSessionRecord = {
      ...refreshGroupDiscussionSessionAnalysis(session),
      status: "completed",
      currentPhase: "review",
      endedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      const response = await fetch("/api/group-discussion/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": crypto.randomUUID(),
          "x-operation-id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          session: endedSession,
          finalAnswer: endedSession.finalAnswer,
          presentationText: endedSession.presentationText,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data && typeof data === "object" && "error" in data
            ? String(data.error)
            : "採点に失敗しました。",
        );
      }
      const parsed = groupDiscussionFinalizeOutputSchema.parse(data);
      saveSession({
        ...endedSession,
        metrics: parsed.metrics,
        discussionMap: parsed.discussionMap,
        finalEvaluation: parsed.finalEvaluation,
        recommendedDrills: parsed.finalEvaluation.recommendedDrills,
      });
      setStatus("採点レポートを保存しました。");
    } catch (error) {
      const fallback = createMockFinalEvaluation(endedSession);
      saveSession({
        ...endedSession,
        metrics: fallback.metrics,
        discussionMap: fallback.discussionMap,
        finalEvaluation: fallback.finalEvaluation,
        recommendedDrills: fallback.finalEvaluation.recommendedDrills,
      });
      setStatus(
        error instanceof Error
          ? `${error.message} ローカル評価で保存しました。`
          : "ローカル評価で保存しました。",
      );
    } finally {
      setEnding(false);
    }
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
        <h1 className="text-2xl font-semibold">セッションが見つかりません</h1>
        <p className="text-sm font-medium text-[#6e6e73]">
          履歴から削除されたか、別のアカウントのセッションです。
        </p>
        <Link
          href="/group-discussion"
          className="inline-flex h-11 w-fit items-center rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white"
        >
          GD練習へ戻る
        </Link>
      </div>
    );
  }

  const leftSeconds = remainingSeconds(session, now);
  const elapsed = elapsedSeconds(session, now);
  const phaseIndex = phaseOrder.indexOf(session.currentPhase);
  const progressPercent =
    session.durationMinutes <= 0
      ? 0
      : Math.min(100, Math.round((elapsed / (session.durationMinutes * 60)) * 100));

  return (
    <div className="grid gap-4">
      <PageHeader
        title="実戦型GD練習"
        description="テーマ、フェーズ、発話ログ、最終結論を残しながら、本番に近い議論を練習します。"
        dense
      />

      <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Topic
            </p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              {session.topic}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-10 items-center gap-2 rounded-full bg-[#f5f5f7] px-4 text-sm font-semibold">
              <Timer className="h-4 w-4" aria-hidden />
              残り {formatClock(leftSeconds)}
            </span>
            <button
              type="button"
              onClick={endSession}
              disabled={ending || session.status === "completed"}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1d1d1f] px-4 text-sm font-semibold text-white disabled:bg-[#86868b]"
            >
              {ending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trophy className="h-4 w-4" aria-hidden />
              )}
              終了して採点
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <InfoBlock title="前提条件" items={session.topicDetails.constraints} />
          <InfoBlock
            title="目標アウトプット"
            items={[session.topicDetails.deliverable || "結論と理由をまとめる"]}
          />
          <InfoBlock
            title="よくある落とし穴"
            items={session.topicDetails.commonTraps}
          />
        </div>

        <div className="mt-4 grid gap-3">
          <div className="h-2 overflow-hidden rounded-full bg-[#f5f5f7]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {phaseOrder.map((phase, index) => (
              <span
                key={phase}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold",
                  index <= phaseIndex
                    ? "bg-[#1d1d1f] text-white"
                    : "bg-[#f5f5f7] text-[#86868b]",
                )}
              >
                {gdPhaseLabels[phase]}
              </span>
            ))}
            <button
              type="button"
              onClick={advancePhase}
              disabled={phaseIndex >= phaseOrder.length - 1}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-semibold text-[#1d1d1f] ring-1 ring-black/[0.08] disabled:opacity-50"
            >
              フェーズを進める
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          {session.practiceMode === "guided" ? (
            <p className="rounded-2xl bg-[#f5f5f7] p-3 text-sm font-semibold leading-6 text-[#6e6e73]">
              {phaseHint(session.currentPhase)}
            </p>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
        <section className="grid gap-4 rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">発言ログ</h2>
            {aiBusy ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-semibold text-[#6e6e73]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                AI発言中
              </span>
            ) : null}
          </div>
          <div className="grid max-h-[460px] gap-3 overflow-y-auto pr-1">
            {session.utterances.length === 0 ? (
              <p className="rounded-3xl bg-[#f5f5f7] p-5 text-sm font-semibold text-[#6e6e73]">
                発話を入力すると、ここにログと行動タグが追加されます。
              </p>
            ) : (
              session.utterances.map((utterance) => (
                <article
                  key={utterance.id}
                  className="rounded-3xl bg-[#f5f5f7] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {utterance.speakerType === "user" ? (
                      <UserRound className="h-4 w-4" aria-hidden />
                    ) : (
                      <Bot className="h-4 w-4" aria-hidden />
                    )}
                    <p className="text-sm font-semibold">
                      {utterance.speakerName}
                    </p>
                    {tagsForDisplay(utterance).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-neutral-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-base font-semibold leading-7">
                    {utterance.text}
                  </p>
                </article>
              ))
            )}
          </div>

          <div className="grid gap-3 rounded-3xl bg-[#f5f5f7] p-3">
            <label className="text-sm font-semibold" htmlFor="gd-utterance">
              発話を入力
            </label>
            <textarea
              id="gd-utterance"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-24 rounded-2xl border border-black/[0.08] bg-white p-4 text-base font-semibold leading-7 outline-none focus:border-[var(--accent)]"
              placeholder="例: まず前提と評価基準を置いて、効果・実現性・リスクで比較しませんか。"
            />
            <button
              type="button"
              onClick={submitManual}
              disabled={!draft.trim() || aiBusy}
              className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white disabled:bg-[#86868b]"
            >
              <Send className="h-4 w-4" aria-hidden />
              発話を追加
            </button>
          </div>
        </section>

        <aside className="grid gap-4">
          <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
            <h2 className="text-xl font-semibold">AI参加者</h2>
            <div className="mt-3 grid gap-2">
              {session.participants
                .filter((participant) => participant.type !== "user")
                .map((participant) => (
                  <div
                    key={participant.id}
                    className="rounded-2xl bg-[#f5f5f7] p-3"
                  >
                    <p className="text-sm font-semibold">{participant.name}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[#6e6e73]">
                      {participant.role} / {participant.stance}
                    </p>
                  </div>
                ))}
              {session.mode === "solo" ? (
                <p className="rounded-2xl bg-[#f5f5f7] p-3 text-sm font-semibold text-[#6e6e73]">
                  1人練習ではAI参加者は出ません。論点整理と結論形成に集中します。
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-[30px] bg-[#f5f5f7] p-5 shadow-sm ring-1 ring-black/[0.06]">
            <GroupDiscussionMapView map={session.discussionMap} compact />
          </section>
        </aside>
      </div>

      <section className="grid gap-3 rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
        <h2 className="text-xl font-semibold">論点メモ / 簡易ホワイトボード</h2>
        <textarea
          value={session.whiteboardNotes}
          onChange={(event) =>
            patchSession(session, { whiteboardNotes: event.target.value })
          }
          className="min-h-28 rounded-3xl border border-black/[0.08] bg-[#f5f5f7] p-4 text-sm font-semibold leading-7 outline-none focus:border-[var(--accent)]"
          placeholder="評価基準、案、リスク、結論候補をメモします。"
        />
      </section>

      <section className="grid gap-4 rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06] md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          最終結論
          <textarea
            value={session.finalAnswer}
            onChange={(event) =>
              patchSession(session, { finalAnswer: event.target.value })
            }
            className="min-h-32 rounded-3xl border border-black/[0.08] bg-[#f5f5f7] p-4 text-base font-semibold leading-7 outline-none focus:border-[var(--accent)]"
            placeholder="最終的に提案する施策、理由、懸念点をまとめます。"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          2分発表メモ
          <textarea
            value={session.presentationText}
            onChange={(event) =>
              patchSession(session, { presentationText: event.target.value })
            }
            className="min-h-32 rounded-3xl border border-black/[0.08] bg-[#f5f5f7] p-4 text-base font-semibold leading-7 outline-none focus:border-[var(--accent)]"
            placeholder="結論、理由、実行手順、リスクを2分で話す形にします。"
          />
          <button
            type="button"
            onClick={() =>
              patchSession(session, {
                presentationText: buildPresentationDraft(session),
              })
            }
            className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-[#1d1d1f] px-4 text-xs font-semibold text-white"
          >
            <Mic className="h-4 w-4" aria-hidden />
            発表練習文を作る
          </button>
        </label>
      </section>

      <AudioCapturePanel
        compact
        onTranscriptItemsChange={handleTranscriptItems}
        autoSubmitRemoteFinal={false}
      />

      {status ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          <span>{status}</span>
          {session.mode === "ai-participants" && !aiBusy ? (
            <button
              type="button"
              onClick={() => requestAiTurn(session)}
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-950"
            >
              AI発言を再試行
            </button>
          ) : null}
        </div>
      ) : null}

      {session.status === "completed" ? (
        <Link
          href={`/group-discussion/result/${session.id}`}
          className="inline-flex h-12 w-fit items-center gap-2 rounded-full bg-[#1d1d1f] px-6 text-sm font-semibold text-white"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          結果を見る
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-[#f5f5f7] p-3">
      <p className="text-xs font-semibold text-[#86868b]">{title}</p>
      <div className="mt-2 grid gap-1 text-sm font-semibold leading-6 text-[#1d1d1f]">
        {items.length > 0 ? (
          items.slice(0, 4).map((item) => <p key={item}>・{item}</p>)
        ) : (
          <p>・練習中に具体化します</p>
        )}
      </div>
    </div>
  );
}
