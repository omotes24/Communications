"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
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
  type GDEvaluationFocus,
  type GDPersona,
  type GDPracticeMode,
  type GDTopicDetails,
  type GDTopicType,
  type GroupDiscussionMode,
  type GroupDiscussionSessionRecord,
} from "@/lib/schemas/groupDiscussion";
import type { CompanyProfile, UserProfile } from "@/lib/schemas/interview";
import { useAppStorage } from "@/lib/storage/use-app-storage";
import { cn } from "@/lib/utils";

const defaultTopic =
  "地方自治体の若年層流出を減らすために、限られた予算で優先すべき施策を提案してください。";

const defaultTopicDetails: GDTopicDetails = {
  title: "若年層流出を減らす施策",
  background:
    "限られた予算の中で、効果と実現性を比較しながら優先施策を決める練習です。",
  constraints: ["予算は限定的", "短期で検証できる施策を優先する"],
  deliverable: "優先すべき施策、理由、実行ステップ、懸念点をまとめる",
  evaluationFocus: ["論点整理", "意思決定", "結論品質"],
  suggestedTimeAllocation: ["前提確認 2分", "案出し 5分", "比較 6分", "結論 3分"],
  sampleGoodDirection:
    "対象者、評価基準、選択肢を先に置き、効果・実現性・リスクで比較する。",
  commonTraps: ["案出しだけで終わる", "判断基準が曖昧になる"],
  assumedCompanyOrIndustry: "",
};

const practiceModes: {
  value: GDPracticeMode;
  label: string;
  description: string;
}[] = [
  {
    value: "guided",
    label: "初心者向け",
    description: "フェーズごとに進め方のヒントを出します。",
  },
  {
    value: "realistic",
    label: "本番形式",
    description: "原則ヒントなしで、本番に近い流れにします。",
  },
  {
    value: "pressure",
    label: "高難度",
    description: "反論・沈黙・脱線などの負荷を少し入れます。",
  },
  {
    value: "one_person_drill",
    label: "1人練習",
    description: "論点整理と結論形成に集中します。",
  },
];

const topicTypes: { value: GDTopicType; label: string }[] = [
  { value: "problem_solving", label: "課題解決型" },
  { value: "prioritization", label: "優先順位付け型" },
  { value: "new_business", label: "新規事業型" },
  { value: "marketing", label: "マーケ施策型" },
  { value: "public_policy", label: "社会課題/自治体型" },
  { value: "industry_case", label: "業界/企業ケース型" },
  { value: "abstract", label: "抽象テーマ型" },
  { value: "debate", label: "賛否討論型" },
  { value: "document_based", label: "資料読み取り型" },
];

const personaOptions: { value: GDPersona; label: string }[] = [
  { value: "balanced", label: "標準" },
  { value: "quiet", label: "寡黙" },
  { value: "dominant", label: "多弁" },
  { value: "logical", label: "論理派" },
  { value: "off_topic", label: "脱線気味" },
  { value: "agreeable", label: "同意派" },
  { value: "skeptical", label: "反論派" },
  { value: "time_keeper", label: "時間管理" },
];

const evaluationFocusOptions: { value: GDEvaluationFocus; label: string }[] = [
  { value: "logical_thinking", label: "論理性" },
  { value: "facilitation", label: "進行" },
  { value: "collaboration", label: "協調性" },
  { value: "summarization", label: "要約力" },
  { value: "decision_making", label: "意思決定" },
  { value: "presentation", label: "発表力" },
  { value: "company_fit", label: "企業相性" },
];

function joinProfileContext(profiles: UserProfile[]) {
  return profiles
    .map((profile) =>
      [
        profile.label,
        profile.affiliation,
        profile.currentRole,
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
        company.philosophy,
        company.jobDescription,
        company.requiredSkills,
        company.researchSummary,
        company.interviewFocus,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

function toggleValue<T extends string>(values: T[], value: T, min = 0): T[] {
  if (values.includes(value)) {
    return values.length > min ? values.filter((item) => item !== value) : values;
  }
  return [...values, value];
}

function buildTokenEstimate({
  mode,
  durationMinutes,
  participantCount,
}: {
  mode: GroupDiscussionMode;
  durationMinutes: number;
  participantCount: number;
}) {
  const base = mode === "ai-participants" ? 1400 : 700;
  const perMinute = mode === "ai-participants" ? 520 + participantCount * 180 : 240;
  const min = Math.round((base + durationMinutes * perMinute) / 100) * 100;
  return {
    min,
    max: Math.round(min * 1.45 / 100) * 100,
  };
}

export function GroupDiscussionSetup() {
  const router = useRouter();
  const { storage, actions, cloudSyncEnabled } = useAppStorage();
  const [mode, setMode] = useState<GroupDiscussionMode>("ai-participants");
  const [practiceMode, setPracticeMode] =
    useState<GDPracticeMode>("realistic");
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [category, setCategory] = useState("ビジネス");
  const [difficulty, setDifficulty] = useState<"standard" | "hard">(
    "standard",
  );
  const [topicType, setTopicType] =
    useState<GDTopicType>("problem_solving");
  const [participantCount, setParticipantCount] = useState(3);
  const [personas, setPersonas] = useState<GDPersona[]>([
    "balanced",
    "logical",
    "time_keeper",
  ]);
  const [evaluationFocus, setEvaluationFocus] = useState<GDEvaluationFocus[]>([
    "logical_thinking",
    "facilitation",
    "decision_making",
  ]);
  const [topic, setTopic] = useState(defaultTopic);
  const [topicDetails, setTopicDetails] =
    useState<GDTopicDetails>(defaultTopicDetails);
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
  const activeMode =
    practiceMode === "one_person_drill" ? "solo" : mode;
  const tokenEstimate = useMemo(
    () =>
      buildTokenEstimate({
        mode: activeMode,
        durationMinutes,
        participantCount,
      }),
    [activeMode, durationMinutes, participantCount],
  );

  function selectPracticeMode(next: GDPracticeMode) {
    setPracticeMode(next);
    if (next === "one_person_drill") {
      setMode("solo");
      return;
    }
    if (mode === "solo") {
      setMode("ai-participants");
    }
  }

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
          topicType,
          practiceMode,
          durationMinutes,
          evaluationFocus,
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
      setTopicDetails({
        title: parsed.title,
        background: parsed.background,
        constraints: [...parsed.constraints, ...parsed.assumptions],
        deliverable: parsed.deliverable,
        evaluationFocus: parsed.evaluation_focus,
        suggestedTimeAllocation: parsed.suggested_time_allocation,
        sampleGoodDirection: parsed.sample_good_direction,
        commonTraps: [...parsed.common_traps, ...parsed.expectedIssues],
        assumedCompanyOrIndustry: parsed.assumed_company_or_industry,
      });
      setStatus("テーマを生成しました。評価ポイントを確認して開始できます。");
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
    const selectedPersonas =
      personas.length >= participantCount
        ? personas.slice(0, participantCount)
        : [
            ...personas,
            ...personaOptions
              .map((item) => item.value)
              .filter((persona) => !personas.includes(persona)),
          ].slice(0, participantCount);
    const participants =
      activeMode === "ai-participants"
        ? createDefaultAiParticipants(selectedPersonas, participantCount)
        : [];
    const session: GroupDiscussionSessionRecord = {
      id: sessionId,
      mode: activeMode,
      practiceMode,
      status: "active",
      topic: topic.trim() || defaultTopic,
      topicCategory: category,
      topicType,
      difficulty,
      durationMinutes,
      userRole: "参加者",
      participants: [
        {
          id: "user",
          name: "あなた",
          role: "参加者",
          stance: "論点整理・巻き込み・結論形成を練習する",
          type: "user",
        },
        ...participants,
      ],
      aiParticipantCount: participants.length,
      aiPersonas: selectedPersonas,
      evaluationFocus,
      profileSlotIds: selectedProfiles.map((profile) => profile.id),
      companySlotIds: selectedCompanies.map((company) => company.id),
      topicDetails,
      currentPhase: "intro",
      phaseHistory: [{ phase: "intro", startedAt: now, endedAt: null }],
      whiteboardNotes: "",
      finalAnswer: "",
      presentationText: "",
      recommendedDrills: [],
      estimatedTokenRange: tokenEstimate,
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
        title="グループディスカッションを、AIで実戦練習。"
        description="AI参加者と本番形式で議論し、発言ログから論点整理・巻き込み・合意形成・結論品質を採点します。練習後は、採用目線のフィードバックと次にやるべきドリルを提示します。"
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
            <p className="mt-2 text-sm font-semibold leading-6 text-[#6e6e73]">
              発言量ではなく、議論を前に進める行動を評価します。
            </p>
          </div>
          <Link
            href="/group-discussion/history"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#f5f5f7] px-4 text-sm font-semibold text-[#1d1d1f] ring-1 ring-black/[0.06]"
          >
            <History className="h-4 w-4" aria-hidden />
            履歴
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {[
            {
              value: "ai-participants" as const,
              title: "AI参加者付き",
              description:
                "AI参加者が短く発言し、本番に近い会話量と予期しない反応を再現します。",
              icon: UsersRound,
            },
            {
              value: "solo" as const,
              title: "1人練習",
              description:
                "自分の発言だけで、論点整理・結論形成・発表構成を練習します。初回練習におすすめです。",
              icon: Mic,
            },
          ].map((option) => {
            const Icon = option.icon;
            const selected = activeMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setMode(option.value);
                  if (option.value === "solo") {
                    setPracticeMode("one_person_drill");
                  } else if (practiceMode === "one_person_drill") {
                    setPracticeMode("realistic");
                  }
                }}
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

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {practiceModes.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => selectPracticeMode(option.value)}
              className={cn(
                "rounded-3xl p-4 text-left ring-1 transition",
                practiceMode === option.value
                  ? "bg-[var(--accent)] text-white ring-[var(--accent)]"
                  : "bg-[#f5f5f7] text-[#1d1d1f] ring-black/[0.06] hover:bg-white",
              )}
            >
              <p className="text-sm font-semibold">{option.label}</p>
              <p
                className={cn(
                  "mt-2 text-xs font-semibold leading-5",
                  practiceMode === option.value ? "text-white/70" : "text-[#6e6e73]",
                )}
              >
                {option.description}
              </p>
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SlotPicker
            title="自分スロット"
            icon={<UserRound className="h-4 w-4" aria-hidden />}
            empty="自分スロット未作成"
            cta="自分スロットを作成すると、発言例と評価が自分の経験に寄ります。"
            href="/profile"
            count={selectedProfiles.length}
          >
            {storage.profiles.map((profile, index) => {
              const selected = storage.selectedProfileIds.includes(profile.id);
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
                  {selected ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                  <span className="truncate">
                    SLOT {String.fromCharCode(65 + index)}: {profile.label}
                  </span>
                </button>
              );
            })}
          </SlotPicker>

          <SlotPicker
            title="会社スロット"
            icon={<BriefcaseBusiness className="h-4 w-4" aria-hidden />}
            empty="会社スロット未作成"
            cta="会社スロットを作成すると、志望企業に近いGDテーマと評価軸で練習できます。"
            href="/company"
            count={selectedCompanies.length}
          >
            {storage.companies.map((company, index) => {
              const selected = storage.selectedCompanyIds.includes(company.id);
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
                  {selected ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                  <span className="truncate">
                    SLOT {index + 1}: {company.companyName || company.label}
                  </span>
                </button>
              );
            })}
          </SlotPicker>
        </div>

        <div className="grid gap-4 md:grid-cols-[140px_140px_minmax(0,1fr)]">
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
                setDifficulty(event.target.value === "hard" ? "hard" : "standard")
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

        <div className="grid gap-3">
          <p className="text-sm font-semibold">テーマタイプ</p>
          <div className="flex flex-wrap gap-2">
            {topicTypes.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTopicType(option.value)}
                className={cn(
                  "rounded-full px-3 py-2 text-xs font-semibold ring-1 transition",
                  topicType === option.value
                    ? "bg-[#1d1d1f] text-white ring-[#1d1d1f]"
                    : "bg-white text-[#6e6e73] ring-black/[0.08]",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {activeMode === "ai-participants" ? (
          <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
            <label className="grid gap-2 text-sm font-semibold">
              参加者数
              <select
                value={participantCount}
                onChange={(event) => setParticipantCount(Number(event.target.value))}
                className="h-12 rounded-2xl border border-black/[0.08] bg-white px-4 text-base font-semibold outline-none focus:border-[var(--accent)]"
              >
                {[2, 3, 4, 5].map((count) => (
                  <option key={count} value={count}>
                    AI {count}人
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-2">
              <p className="text-sm font-semibold">AI参加者ペルソナ</p>
              <div className="flex flex-wrap gap-2">
                {personaOptions.map((option) => {
                  const selected = personas.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setPersonas((current) =>
                          toggleValue(current, option.value, 1).slice(0, 5),
                        )
                      }
                      className={cn(
                        "rounded-full px-3 py-2 text-xs font-semibold ring-1 transition",
                        selected
                          ? "bg-[#1d1d1f] text-white ring-[#1d1d1f]"
                          : "bg-white text-[#6e6e73] ring-black/[0.08]",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-2">
          <p className="text-sm font-semibold">評価重点</p>
          <div className="flex flex-wrap gap-2">
            {evaluationFocusOptions.map((option) => {
              const selected = evaluationFocus.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setEvaluationFocus((current) =>
                      toggleValue(current, option.value, 1),
                    )
                  }
                  className={cn(
                    "rounded-full px-3 py-2 text-xs font-semibold ring-1 transition",
                    selected
                      ? "bg-[#1d1d1f] text-white ring-[#1d1d1f]"
                      : "bg-white text-[#6e6e73] ring-black/[0.08]",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="grid gap-2 text-sm font-semibold">
          テーマ
          <textarea
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            className="min-h-32 rounded-3xl border border-black/[0.08] bg-white p-4 text-base font-semibold leading-7 outline-none focus:border-[var(--accent)]"
          />
        </label>

        <section className="grid gap-3 rounded-3xl bg-[#f5f5f7] p-4">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="h-4 w-4" aria-hidden />
            この練習で評価されるポイント
          </h3>
          <p className="text-sm font-semibold leading-6 text-[#6e6e73]">
            この練習では、発言量ではなく、議論を前に進める発言を評価します。論点整理、他者の意見の要約、意思決定、結論品質を中心に採点します。
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <InfoList title="前提条件" items={topicDetails.constraints} />
            <InfoList
              title="よくある落とし穴"
              items={topicDetails.commonTraps}
            />
          </div>
          <p className="rounded-2xl bg-white p-3 text-sm font-semibold leading-6 text-[#1d1d1f]">
            目標アウトプット: {topicDetails.deliverable}
          </p>
        </section>

        <div className="grid gap-3 rounded-3xl bg-white p-4 ring-1 ring-black/[0.08]">
          <p className="text-sm font-semibold">
            目安: {durationMinutes}分・
            {activeMode === "ai-participants"
              ? `AI参加者${participantCount}名`
              : "1人練習"}
            の場合、約{tokenEstimate.min.toLocaleString()}〜
            {tokenEstimate.max.toLocaleString()} tokens
          </p>
          <p className="text-xs font-semibold leading-5 text-[#86868b]">
            練習履歴、発言ログ、AI分析結果は、ログイン中のアカウントに紐づけて保存されます。削除はデータ設定画面から実行できます。
            {!cloudSyncEnabled
              ? " 未ログインまたは通信できない場合は、このブラウザ内に一時保存されます。"
              : ""}
          </p>
        </div>

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
              <Link
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
                  {session.utterances.length}発話 /{" "}
                  {session.finalEvaluation
                    ? `総合${session.finalEvaluation.totalScore}`
                    : "評価未作成"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SlotPicker({
  title,
  icon,
  empty,
  cta,
  href,
  count,
  children,
}: {
  title: string;
  icon: ReactNode;
  empty: string;
  cta: string;
  href: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-[#f5f5f7] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-[#1d1d1f]">
          {icon}
          {title}
        </h3>
        <span className="text-xs font-semibold text-[#86868b]">
          {count}件選択中
        </span>
      </div>
      <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
        {count === 0 && !children ? (
          <p className="text-sm font-medium text-[#86868b]">{empty}</p>
        ) : (
          children
        )}
      </div>
      {count === 0 ? (
        <div className="mt-3 rounded-2xl bg-white p-3">
          <p className="text-xs font-semibold leading-5 text-[#6e6e73]">
            {empty}。{cta}
          </p>
          <Link
            href={href}
            className="mt-2 inline-flex h-8 items-center rounded-full bg-[#1d1d1f] px-3 text-xs font-semibold text-white"
          >
            作成する
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="text-xs font-semibold text-[#86868b]">{title}</p>
      <ul className="mt-2 grid gap-1 text-sm font-semibold leading-6 text-[#1d1d1f]">
        {items.slice(0, 4).map((item) => (
          <li key={item}>・{item}</li>
        ))}
      </ul>
    </div>
  );
}
