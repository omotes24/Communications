import { createHash, createHmac } from "node:crypto";

import { requireAdminApiUser } from "@/lib/auth/admin";
import { estimateOpenAiCostUsd } from "@/lib/billing/openai-cost";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supportedDatasets = new Set([
  "customers",
  "purchases",
  "usage",
  "daily",
  "events",
  "interview_experiences",
]);
const pageSize = 1_000;
const maxRows = 50_000;

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

function accountCode(userId: string): string {
  const secret = process.env.ADMIN_AUDIT_HMAC_SECRET?.trim();
  const digest = secret
    ? createHmac("sha256", secret).update(userId).digest("hex")
    : createHash("sha256").update(userId).digest("hex");
  return `yfy_${digest.slice(0, 12)}`;
}

function daysFromRequest(request: Request): number {
  const value = Number(new URL(request.url).searchParams.get("days") ?? 90);
  return Number.isInteger(value) && value >= 1 && value <= 365 ? value : 90;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

async function paginate<T>(
  load: (from: number, to: number) => PromiseLike<QueryResult>,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const result = await load(from, from + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    const page = (result.data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

function csvCell(value: unknown): string {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvResponse(
  dataset: string,
  headers: string[],
  rows: unknown[][],
  truncated = false,
): Response {
  const body = `\uFEFF${[headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n")}\r\n`;
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="yfy-${dataset}-${date}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Export-Truncated": truncated ? "true" : "false",
    },
  });
}

type ProfileRow = { user_id: string; created_at: string; updated_at: string };
type WalletRow = {
  user_id: string;
  available_balance: number;
  reserved_balance: number;
  lifetime_granted: number;
  lifetime_consumed: number;
};
type PurchaseRow = {
  user_id: string;
  plan_id: string;
  amount_jpy: number;
  token_amount: number;
  livemode: boolean;
  created_at: string;
};
type UsageRow = {
  user_id: string;
  feature: string;
  model: string;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  audio_seconds: number;
  web_search_calls: number;
  calculated_app_tokens: number;
  status: string;
  latency_ms: number | null;
  created_at: string;
};
type EventRow = {
  user_id: string;
  session_hash: string;
  event_name: string;
  feature: string;
  path_group: string;
  outcome: string | null;
  duration_ms: number | null;
  value_numeric: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
type InterviewExperienceRow = {
  user_id: string;
  interview_session_id: string;
  jobtrack_catalog_ref: string | null;
  company_name_snapshot: string;
  interview_month: string | null;
  selection_stage: string;
  employment_type: string;
  interview_format: string;
  role_category: string;
  summary: string;
  overall_impression: string;
  difficulty: number | null;
  questions: Array<{
    question?: string;
    category?: string;
    interviewerIntent?: string;
    answerPreparationHint?: string;
  }>;
  insights: string[];
  normalization_version: string;
  contributed_at: string;
};

function usageCost(row: UsageRow): number {
  return estimateOpenAiCostUsd(
    {
      model: row.model,
      inputTokens: Number(row.input_tokens || 0),
      cachedInputTokens: Number(row.cached_input_tokens || 0),
      outputTokens: Number(row.output_tokens || 0),
      audioSeconds: Number(row.audio_seconds || 0),
      webSearchCalls: Number(row.web_search_calls || 0),
    },
    Number(process.env.OPENAI_WEB_SEARCH_USD_PER_CALL || 0.01),
  ).costUsd;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dataset: string }> },
): Promise<Response> {
  const auth = await requireAdminApiUser();
  if (!auth.ok) return auth.response;

  const { dataset } = await params;
  if (!supportedDatasets.has(dataset)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!getServerSupabaseConfig()?.serviceRoleKey) {
    return Response.json({ error: "Export unavailable" }, { status: 503 });
  }

  const supabase = createSupabaseServiceClient();
  const days = daysFromRequest(request);
  const since = isoDaysAgo(days);

  if (dataset === "purchases") {
    const result = await paginate<PurchaseRow>((from, to) =>
      supabase
        .from("stripe_checkout_grants")
        .select("user_id, plan_id, amount_jpy, token_amount, livemode, created_at")
        .order("created_at", { ascending: false })
        .range(from, to),
    );
    return csvResponse(
      dataset,
      [
        "purchased_at",
        "account_code",
        "plan_id",
        "amount_jpy",
        "token_amount",
        "livemode",
      ],
      result.rows.map((row) => [
        row.created_at,
        accountCode(row.user_id),
        row.plan_id,
        row.amount_jpy,
        row.token_amount,
        row.livemode,
      ]),
      result.truncated,
    );
  }

  if (dataset === "usage") {
    const result = await paginate<UsageRow>((from, to) =>
      supabase
        .from("ai_usage_events")
        .select(
          "user_id, feature, model, input_tokens, cached_input_tokens, output_tokens, reasoning_tokens, audio_seconds, web_search_calls, calculated_app_tokens, status, latency_ms, created_at",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .range(from, to),
    );
    return csvResponse(
      dataset,
      [
        "occurred_at",
        "account_code",
        "feature",
        "model",
        "status",
        "input_tokens",
        "cached_input_tokens",
        "output_tokens",
        "reasoning_tokens_subset",
        "audio_seconds",
        "web_search_calls",
        "app_tokens",
        "latency_ms",
        "estimated_openai_cost_usd",
      ],
      result.rows.map((row) => [
        row.created_at,
        accountCode(row.user_id),
        row.feature,
        row.model,
        row.status,
        row.input_tokens,
        row.cached_input_tokens,
        row.output_tokens,
        row.reasoning_tokens,
        row.audio_seconds,
        row.web_search_calls,
        row.calculated_app_tokens,
        row.latency_ms,
        usageCost(row).toFixed(8),
      ]),
      result.truncated,
    );
  }

  if (dataset === "events") {
    const result = await paginate<EventRow>((from, to) =>
      supabase
        .from("analytics_events")
        .select(
          "user_id, session_hash, event_name, feature, path_group, outcome, duration_ms, value_numeric, metadata, created_at",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .range(from, to),
    );
    return csvResponse(
      dataset,
      [
        "occurred_at",
        "account_code",
        "session_code",
        "event_name",
        "feature",
        "path_group",
        "outcome",
        "duration_ms",
        "value_numeric",
        "source",
        "plan_id",
        "experiment_key",
        "variant",
      ],
      result.rows.map((row) => [
        row.created_at,
        accountCode(row.user_id),
        row.session_hash.slice(0, 16),
        row.event_name,
        row.feature,
        row.path_group,
        row.outcome,
        row.duration_ms,
        row.value_numeric,
        row.metadata?.source,
        row.metadata?.planId,
        row.metadata?.experimentKey,
        row.metadata?.variant,
      ]),
      result.truncated,
    );
  }

  if (dataset === "interview_experiences") {
    const result = await paginate<InterviewExperienceRow>((from, to) =>
      supabase
        .from("interview_experience_reports")
        .select(
          "user_id, interview_session_id, jobtrack_catalog_ref, company_name_snapshot, interview_month, selection_stage, employment_type, interview_format, role_category, summary, overall_impression, difficulty, questions, insights, normalization_version, contributed_at",
        )
        .eq("research_consent", true)
        .eq("review_status", "reviewed")
        .gte("contributed_at", since)
        .order("contributed_at", { ascending: false })
        .range(from, to),
    );
    const rows = result.rows.flatMap((report) => {
      const questions = Array.isArray(report.questions) ? report.questions : [];
      const base = [
        report.contributed_at,
        accountCode(report.user_id),
        accountCode(report.interview_session_id),
        report.jobtrack_catalog_ref,
        report.company_name_snapshot,
        report.interview_month,
        report.selection_stage,
        report.employment_type,
        report.interview_format,
        report.role_category,
        report.difficulty,
        report.summary,
        report.overall_impression,
        report.insights,
        report.normalization_version,
      ];
      if (!questions.length) return [[...base, null, null, null, null, null]];
      return questions.map((question, index) => [
        ...base,
        index + 1,
        question.question,
        question.category,
        question.interviewerIntent,
        question.answerPreparationHint,
      ]);
    });
    return csvResponse(
      dataset,
      [
        "contributed_at",
        "account_code",
        "session_code",
        "jobtrack_private_catalog_ref",
        "company_name_snapshot",
        "interview_month",
        "selection_stage",
        "employment_type",
        "interview_format",
        "role_category",
        "difficulty_1_to_5",
        "summary",
        "overall_impression",
        "insights_json",
        "normalization_version",
        "question_order",
        "question",
        "question_category",
        "interviewer_intent",
        "answer_preparation_hint",
      ],
      rows,
      result.truncated,
    );
  }

  const [profilesResult, walletsResult, purchasesResult, usageResult] =
    await Promise.all([
      paginate<ProfileRow>((from, to) =>
        supabase
          .from("profiles")
          .select("user_id, created_at, updated_at")
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      paginate<WalletRow>((from, to) =>
        supabase
          .from("token_wallets")
          .select(
            "user_id, available_balance, reserved_balance, lifetime_granted, lifetime_consumed",
          )
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      paginate<PurchaseRow>((from, to) =>
        supabase
          .from("stripe_checkout_grants")
          .select("user_id, plan_id, amount_jpy, token_amount, livemode, created_at")
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      paginate<UsageRow>((from, to) =>
        supabase
          .from("ai_usage_events")
          .select(
            "user_id, feature, model, input_tokens, cached_input_tokens, output_tokens, reasoning_tokens, audio_seconds, web_search_calls, calculated_app_tokens, status, latency_ms, created_at",
          )
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
    ]);
  const truncated =
    profilesResult.truncated ||
    walletsResult.truncated ||
    purchasesResult.truncated ||
    usageResult.truncated;

  if (dataset === "daily") {
    const groups = new Map<
      string,
      {
        day: string;
        feature: string;
        model: string;
        users: Set<string>;
        requests: number;
        successes: number;
        failures: number;
        input: number;
        cached: number;
        output: number;
        reasoning: number;
        audio: number;
        searches: number;
        appTokens: number;
        latencyTotal: number;
        latencyCount: number;
        costUsd: number;
      }
    >();
    for (const row of usageResult.rows) {
      const day = row.created_at.slice(0, 10);
      const key = `${day}\u0000${row.feature}\u0000${row.model}`;
      const group = groups.get(key) ?? {
        day,
        feature: row.feature,
        model: row.model,
        users: new Set<string>(),
        requests: 0,
        successes: 0,
        failures: 0,
        input: 0,
        cached: 0,
        output: 0,
        reasoning: 0,
        audio: 0,
        searches: 0,
        appTokens: 0,
        latencyTotal: 0,
        latencyCount: 0,
        costUsd: 0,
      };
      group.users.add(row.user_id);
      group.requests += 1;
      group.successes += row.status === "success" ? 1 : 0;
      group.failures += row.status === "failed" ? 1 : 0;
      group.input += Number(row.input_tokens || 0);
      group.cached += Number(row.cached_input_tokens || 0);
      group.output += Number(row.output_tokens || 0);
      group.reasoning += Number(row.reasoning_tokens || 0);
      group.audio += Number(row.audio_seconds || 0);
      group.searches += Number(row.web_search_calls || 0);
      group.appTokens += Number(row.calculated_app_tokens || 0);
      group.costUsd += usageCost(row);
      if (row.latency_ms != null) {
        group.latencyTotal += row.latency_ms;
        group.latencyCount += 1;
      }
      groups.set(key, group);
    }
    return csvResponse(
      dataset,
      [
        "date",
        "feature",
        "model",
        "unique_users",
        "requests",
        "successes",
        "failures",
        "input_tokens",
        "cached_input_tokens",
        "output_tokens",
        "reasoning_tokens_subset",
        "audio_seconds",
        "web_search_calls",
        "app_tokens",
        "avg_latency_ms",
        "estimated_openai_cost_usd",
      ],
      Array.from(groups.values())
        .sort((a, b) => (a.day < b.day ? 1 : -1))
        .map((group) => [
          group.day,
          group.feature,
          group.model,
          group.users.size,
          group.requests,
          group.successes,
          group.failures,
          group.input,
          group.cached,
          group.output,
          group.reasoning,
          group.audio.toFixed(3),
          group.searches,
          group.appTokens,
          group.latencyCount
            ? Math.round(group.latencyTotal / group.latencyCount)
            : null,
          group.costUsd.toFixed(8),
        ]),
      truncated,
    );
  }

  const wallets = new Map(walletsResult.rows.map((row) => [row.user_id, row]));
  const purchases = new Map<
    string,
    { count: number; amount: number; tokens: number; lastAt: string | null }
  >();
  for (const row of purchasesResult.rows) {
    const value = purchases.get(row.user_id) ?? {
      count: 0,
      amount: 0,
      tokens: 0,
      lastAt: null,
    };
    value.count += 1;
    value.amount += Number(row.amount_jpy || 0);
    value.tokens += Number(row.token_amount || 0);
    if (!value.lastAt || row.created_at > value.lastAt) value.lastAt = row.created_at;
    purchases.set(row.user_id, value);
  }
  const usageByUser = new Map<
    string,
    { requests: number; appTokens: number; failures: number; costUsd: number }
  >();
  for (const row of usageResult.rows) {
    const value = usageByUser.get(row.user_id) ?? {
      requests: 0,
      appTokens: 0,
      failures: 0,
      costUsd: 0,
    };
    value.requests += 1;
    value.appTokens += Number(row.calculated_app_tokens || 0);
    value.failures += row.status === "failed" ? 1 : 0;
    value.costUsd += usageCost(row);
    usageByUser.set(row.user_id, value);
  }

  return csvResponse(
    "customers",
    [
      "account_code",
      "signed_up_at",
      "profile_updated_at",
      "purchase_count",
      "total_purchase_jpy",
      "purchased_tokens",
      "last_purchased_at",
      "available_tokens",
      "reserved_tokens",
      "lifetime_granted_tokens",
      "lifetime_consumed_tokens",
      "usage_window_days",
      "ai_requests",
      "failed_requests",
      "app_tokens_used",
      "estimated_openai_cost_usd",
    ],
    profilesResult.rows.map((profile) => {
      const wallet = wallets.get(profile.user_id);
      const purchase = purchases.get(profile.user_id);
      const usage = usageByUser.get(profile.user_id);
      return [
        accountCode(profile.user_id),
        profile.created_at,
        profile.updated_at,
        purchase?.count ?? 0,
        purchase?.amount ?? 0,
        purchase?.tokens ?? 0,
        purchase?.lastAt,
        wallet?.available_balance ?? 0,
        wallet?.reserved_balance ?? 0,
        wallet?.lifetime_granted ?? 0,
        wallet?.lifetime_consumed ?? 0,
        days,
        usage?.requests ?? 0,
        usage?.failures ?? 0,
        usage?.appTokens ?? 0,
        (usage?.costUsd ?? 0).toFixed(8),
      ];
    }),
    truncated,
  );
}
