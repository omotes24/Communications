"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Loader2,
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
  refreshGroupDiscussionSessionAnalysis,
} from "@/lib/group-discussion/analysis";
import {
  loadLocalGroupDiscussionSessions,
  saveLocalGroupDiscussionSession,
} from "@/lib/group-discussion/local-store";
import { createMockFinalEvaluation } from "@/lib/group-discussion/mock";
import {
  groupDiscussionAiTurnOutputSchema,
  groupDiscussionFinalizeOutputSchema,
  type GroupDiscussionSessionRecord,
  type GroupDiscussionUtterance,
} from "@/lib/schemas/groupDiscussion";
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

function formatClock(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt) {
    return "00:00";
  }
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
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

function metricTone(score: number): string {
  if (score >= 75) {
    return "bg-emerald-50 text-emerald-900";
  }
  if (score >= 45) {
    return "bg-amber-50 text-amber-900";
  }
  return "bg-rose-50 text-rose-900";
}

function MetricsGrid({ session }: { session: GroupDiscussionSessionRecord }) {
  const metrics = session.metrics;
  if (!metrics) {
    return (
      <p className="rounded-3xl bg-[#f5f5f7] p-4 text-sm font-semibold text-[#6e6e73]">
        発話が入ると、発言時間・質問回数・論点整理などを自動で更新します。
      </p>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {metricKeys.map((key) => {
        const item = metrics[key];
        return (
          <div
            key={key}
            className={cn("rounded-2xl p-3", metricTone(item.score))}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">{item.label}</p>
              <p className="text-lg font-semibold">{item.score}</p>
            </div>
            <p className="mt-1 text-xs font-medium opacity-75">
              {item.value}
              {key === "speakingTimeSeconds" ? "秒" : "件"}
            </p>
          </div>
        );
      })}
    </div>
  );
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

  const session = useMemo(
    () =>
      storage.groupDiscussionSessions.find((item) => item.id === sessionId) ??
      localSessions.find((item) => item.id === sessionId) ??
      null,
    [localSessions, sessionId, storage.groupDiscussionSessions],
  );

  function saveSession(next: GroupDiscussionSessionRecord) {
    actions.saveGroupDiscussionSession(next);
    setLocalSessions(saveLocalGroupDiscussionSession(next));
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
        body: JSON.stringify({ session: baseSession }),
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

  async function endSession() {
    if (!session || session.utterances.length === 0) {
      setStatus("発話を1件以上追加してから終了してください。");
      return;
    }
    setEnding(true);
    setStatus("最終評価を作成しています。");
    const endedSession: GroupDiscussionSessionRecord = {
      ...refreshGroupDiscussionSessionAnalysis(session),
      status: "completed",
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
        body: JSON.stringify({ session: endedSession }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data && typeof data === "object" && "error" in data
            ? String(data.error)
            : "最終評価に失敗しました。",
        );
      }
      const parsed = groupDiscussionFinalizeOutputSchema.parse(data);
      saveSession({
        ...endedSession,
        metrics: parsed.metrics,
        discussionMap: parsed.discussionMap,
        finalEvaluation: parsed.finalEvaluation,
      });
      setStatus("最終評価を保存しました。");
    } catch (error) {
      const fallback = createMockFinalEvaluation(endedSession);
      saveSession({
        ...endedSession,
        metrics: fallback.metrics,
        discussionMap: fallback.discussionMap,
        finalEvaluation: fallback.finalEvaluation,
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

  const userUtterances = session.utterances.filter(
    (utterance) => utterance.speakerType === "user",
  );

  return (
    <div className="grid gap-4">
      <PageHeader
        title="GD練習"
        description="発話を入れると、論点整理・質問・結論形成をリアルタイムで分析します。"
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
              {formatClock(session.startedAt, session.endedAt)}
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
              終了して評価
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-semibold text-[#6e6e73]">
            {session.mode === "ai-participants" ? "AI参加者付き" : "1人練習"}
          </span>
          <span className="rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-semibold text-[#6e6e73]">
            {session.durationMinutes}分
          </span>
          <span className="rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-semibold text-[#6e6e73]">
            {userUtterances.length}発話
          </span>
        </div>
        <p className="mt-4 rounded-2xl bg-[#f5f5f7] p-3 text-sm font-semibold leading-6 text-[#6e6e73]">
          練習専用です。実選考での無断録音や隠れた支援には使わないでください。
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
        <section className="grid gap-4 rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">発話ログ</h2>
            {aiBusy ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-semibold text-[#6e6e73]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                AI発言中
              </span>
            ) : null}
          </div>
          <div className="grid max-h-[520px] gap-3 overflow-y-auto pr-1">
            {session.utterances.length === 0 ? (
              <p className="rounded-3xl bg-[#f5f5f7] p-5 text-sm font-semibold text-[#6e6e73]">
                発話を入力すると、ここにログと分析が追加されます。
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
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">
                      {utterance.durationSeconds}秒
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-base font-semibold leading-7">
                    {utterance.text}
                  </p>
                  {utterance.analysis ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {utterance.analysis.isQuestion ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
                          質問
                        </span>
                      ) : null}
                      {utterance.analysis.connectsToPrevious ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
                          接続
                        </span>
                      ) : null}
                      {utterance.analysis.issueOrganization ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
                          論点整理
                        </span>
                      ) : null}
                      {utterance.analysis.conclusionContribution ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
                          結論
                        </span>
                      ) : null}
                    </div>
                  ) : null}
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
              placeholder="例: 今の意見に加えて、まず評価基準を3つに分けたいです。"
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
            <h2 className="mb-3 text-xl font-semibold">リアルタイム分析</h2>
            <MetricsGrid session={session} />
          </section>
          <section className="rounded-[30px] bg-[#f5f5f7] p-5 shadow-sm ring-1 ring-black/[0.06]">
            <GroupDiscussionMapView map={session.discussionMap} compact />
          </section>
        </aside>
      </div>

      <AudioCapturePanel
        compact
        onTranscriptItemsChange={handleTranscriptItems}
        autoSubmitRemoteFinal={false}
      />

      {status ? (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          {status}
        </p>
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
