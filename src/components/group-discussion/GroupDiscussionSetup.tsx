"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  History,
  Loader2,
  Mic,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { saveLocalGroupDiscussionSession } from "@/lib/group-discussion/local-store";
import { createDefaultAiParticipants } from "@/lib/group-discussion/mock";
import {
  groupDiscussionTopicOutputSchema,
  type GroupDiscussionMode,
  type GroupDiscussionSessionRecord,
} from "@/lib/schemas/groupDiscussion";
import type { CompanyProfile, UserProfile } from "@/lib/schemas/interview";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import { cn } from "@/lib/utils";

const defaultTopic =
  "地方自治体の若年層流出を減らすために、限られた予算で優先すべき施策を提案してください。";

function joinProfileContext(profiles: UserProfile[]) {
  return profiles
    .map((profile) =>
      [
        profile.label,
        profile.affiliation,
        profile.careerSummary,
        profile.strengths,
        profile.achievements,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

function joinCompanyContext(companies: CompanyProfile[]) {
  return companies
    .map((company) =>
      [
        company.companyName,
        company.targetRole,
        company.business,
        company.researchSummary,
        company.interviewFocus,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

export function GroupDiscussionSetup() {
  const router = useRouter();
  const { storage, actions } = useAppStorage();
  const [mode, setMode] = useState<GroupDiscussionMode>("ai-participants");
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [category, setCategory] = useState("ビジネス");
  const [difficulty, setDifficulty] = useState<"standard" | "hard">(
    "standard",
  );
  const [topic, setTopic] = useState(defaultTopic);
  const [topicNotes, setTopicNotes] = useState<string[]>([
    "対象者・予算・期限などの前提を最初に置くと練習しやすくなります。",
  ]);
  const [status, setStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const recentSessions = useMemo(
    () => storage.groupDiscussionSessions.slice(0, 3),
    [storage.groupDiscussionSessions],
  );
  const selectedProfiles = useMemo(
    () =>
      storage.selectedProfileIds
        .map((id) => storage.profiles.find((profile) => profile.id === id))
        .filter((profile): profile is UserProfile => Boolean(profile)),
    [storage.profiles, storage.selectedProfileIds],
  );
  const selectedCompanies = useMemo(
    () =>
      storage.selectedCompanyIds
        .map((id) => storage.companies.find((company) => company.id === id))
        .filter((company): company is CompanyProfile => Boolean(company)),
    [storage.companies, storage.selectedCompanyIds],
  );

  async function generateTopic() {
    setGenerating(true);
    setStatus(null);
    try {
      const response = await fetch("/api/group-discussion/topic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": crypto.randomUUID(),
          "x-operation-id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          category,
          difficulty,
          companyContext: joinCompanyContext(selectedCompanies),
          profileContext: joinProfileContext(selectedProfiles),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data && typeof data === "object" && "error" in data
            ? String(data.error)
            : "テーマ生成に失敗しました。",
        );
      }
      const parsed = groupDiscussionTopicOutputSchema.parse(data);
      setTopic(parsed.topic);
      setTopicNotes([...parsed.assumptions, ...parsed.expectedIssues]);
      setStatus("テーマを生成しました。内容を確認して開始できます。");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "テーマ生成に失敗しました。手動テーマで開始できます。",
      );
    } finally {
      setGenerating(false);
    }
  }

  function startSession() {
    const now = new Date().toISOString();
    const sessionId = crypto.randomUUID();
    const participants =
      mode === "ai-participants" ? createDefaultAiParticipants() : [];
    const session: GroupDiscussionSessionRecord = {
      id: sessionId,
      mode,
      status: "active",
      topic: topic.trim() || defaultTopic,
      topicCategory: category,
      durationMinutes,
      userRole: "参加者",
      participants: [
        {
          id: "user",
          name: "あなた",
          role: "参加者",
          stance: "発言・整理・結論形成を練習する",
          type: "user",
        },
        ...participants,
      ],
      utterances: [],
      discussionMap: {
        nodes: [
          {
            id: "topic",
            type: "topic",
            label: topic.trim() || defaultTopic,
            evidenceUtteranceIds: [],
          },
        ],
        edges: [],
      },
      metrics: null,
      finalEvaluation: null,
      saveTranscript: true,
      createdAt: now,
      startedAt: now,
      endedAt: null,
      updatedAt: now,
    };
    actions.saveGroupDiscussionSession(session);
    saveLocalGroupDiscussionSession(session);
    router.push(`/group-discussion/session/${sessionId}`);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="グループディスカッション"
        description="AI参加者と実戦形式で練習し、発言・論点整理・結論形成を分析します。"
      />

      <section className="grid gap-4 rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Setup
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              練習条件を決める
            </h2>
          </div>
          <a
            href="/group-discussion/history"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#f5f5f7] px-4 text-sm font-semibold text-[#1d1d1f] ring-1 ring-black/[0.06]"
          >
            <History className="h-4 w-4" aria-hidden />
            履歴
          </a>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {[
            {
              value: "ai-participants" as const,
              title: "AI参加者付き",
              description: "AIが短く発言し、実戦に近い会話量で練習します。",
              icon: UsersRound,
            },
            {
              value: "solo" as const,
              title: "1人練習",
              description: "自分の発言だけで論点整理と結論形成を練習します。",
              icon: Mic,
            },
          ].map((option) => {
            const Icon = option.icon;
            const selected = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                className={cn(
                  "rounded-3xl p-4 text-left ring-1 transition",
                  selected
                    ? "bg-[#1d1d1f] text-white ring-[#1d1d1f]"
                    : "bg-[#f5f5f7] text-[#1d1d1f] ring-black/[0.06] hover:bg-white",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <p className="mt-4 text-lg font-semibold">{option.title}</p>
                <p
                  className={cn(
                    "mt-2 text-sm font-medium leading-6",
                    selected ? "text-white/65" : "text-[#6e6e73]",
                  )}
                >
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-3xl bg-[#f5f5f7] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-[#1d1d1f]">
                <UserRound className="h-4 w-4" aria-hidden />
                自分スロット
              </h3>
              <span className="text-xs font-semibold text-[#86868b]">
                {selectedProfiles.length}件選択中
              </span>
            </div>
            <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
              {storage.profiles.length === 0 ? (
                <p className="text-sm font-medium text-[#86868b]">
                  自分スロット未作成
                </p>
              ) : (
                storage.profiles.map((profile, index) => {
                  const selected = storage.selectedProfileIds.includes(
                    profile.id,
                  );
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => actions.toggleSelectedProfile(profile.id)}
                      aria-pressed={selected}
                      className={cn(
                        "inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition",
                        selected
                          ? "bg-[#1d1d1f] text-white"
                          : "bg-white text-[#6e6e73] ring-1 ring-black/[0.06] hover:text-[#1d1d1f]",
                      )}
                    >
                      {selected ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      ) : null}
                      <span className="truncate">
                        SLOT {String.fromCharCode(65 + index)}: {profile.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-[#f5f5f7] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-[#1d1d1f]">
                <BriefcaseBusiness className="h-4 w-4" aria-hidden />
                会社スロット
              </h3>
              <span className="text-xs font-semibold text-[#86868b]">
                {selectedCompanies.length}件選択中
              </span>
            </div>
            <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
              {storage.companies.length === 0 ? (
                <p className="text-sm font-medium text-[#86868b]">
                  会社スロット未作成
                </p>
              ) : (
                storage.companies.map((company, index) => {
                  const selected = storage.selectedCompanyIds.includes(
                    company.id,
                  );
                  return (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => actions.toggleSelectedCompany(company.id)}
                      aria-pressed={selected}
                      className={cn(
                        "inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition",
                        selected
                          ? "bg-[#1d1d1f] text-white"
                          : "bg-white text-[#6e6e73] ring-1 ring-black/[0.06] hover:text-[#1d1d1f]",
                      )}
                    >
                      {selected ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      ) : null}
                      <span className="truncate">
                        SLOT {index + 1}: {company.companyName || company.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-4 md:grid-cols-[160px_160px_minmax(0,1fr)]">
          <label className="grid gap-2 text-sm font-semibold">
            時間
            <select
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              className="h-12 rounded-2xl border border-black/[0.08] bg-white px-4 text-base font-semibold outline-none focus:border-[var(--accent)]"
            >
              {[10, 15, 20, 30, 45].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes}分
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            お題の難しさ
            <select
              value={difficulty}
              onChange={(event) =>
                setDifficulty(
                  event.target.value === "hard" ? "hard" : "standard",
                )
              }
              className="h-12 rounded-2xl border border-black/[0.08] bg-white px-4 text-base font-semibold outline-none focus:border-[var(--accent)]"
            >
              <option value="standard">標準</option>
              <option value="hard">難しめ</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            カテゴリ
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-12 rounded-2xl border border-black/[0.08] bg-white px-4 text-base font-semibold outline-none focus:border-[var(--accent)]"
              placeholder="ビジネス / 社会課題 / 金融 / 環境"
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-semibold">
          テーマ
          <textarea
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            className="min-h-32 rounded-3xl border border-black/[0.08] bg-white p-4 text-base font-semibold leading-7 outline-none focus:border-[var(--accent)]"
          />
        </label>

        {topicNotes.length > 0 ? (
          <div className="grid gap-2 rounded-3xl bg-[#f5f5f7] p-4">
            {topicNotes.slice(0, 5).map((note) => (
              <p key={note} className="text-sm font-medium text-[#6e6e73]">
                {note}
              </p>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={generateTopic}
            disabled={generating}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#1d1d1f] shadow-sm ring-1 ring-black/[0.08] disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            AIテーマ生成
          </button>
          <button
            type="button"
            onClick={startSession}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-white shadow-sm hover:bg-[var(--accent-hover)]"
          >
            練習を始める
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {status ? (
          <p className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            {status}
          </p>
        ) : null}
      </section>

      {recentSessions.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">最近の練習</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {recentSessions.map((session) => (
              <a
                key={session.id}
                href={`/group-discussion/result/${session.id}`}
                className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/[0.06] transition hover:-translate-y-0.5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  {session.status === "completed" ? "Result" : "Session"}
                </p>
                <p className="mt-3 line-clamp-3 text-base font-semibold leading-6">
                  {session.topic}
                </p>
                <p className="mt-3 text-sm font-medium text-[#6e6e73]">
                  {session.utterances.length}発話
                </p>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
