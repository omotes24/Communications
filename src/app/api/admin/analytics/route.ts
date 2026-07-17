import { z } from "zod";

import { requireAdminApiUser } from "@/lib/auth/admin";
import { privateJson } from "@/lib/privacy/private-response";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedRanges = new Set([7, 30, 90]);

const summarySchema = z.object({
  rangeDays: z.number().int(),
  startsAt: z.string(),
  endsAt: z.string(),
  pageViews: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
  pagesPerSession: z.number().nonnegative(),
  singlePageRate: z.number().min(0).max(100),
  todayPageViews: z.number().int().nonnegative(),
  todaySessions: z.number().int().nonnegative(),
  collectedSince: z.string().nullable(),
  lastReceivedAt: z.string().nullable(),
  daily: z.array(
    z.object({
      day: z.string(),
      pageViews: z.number().int().nonnegative(),
      sessions: z.number().int().nonnegative(),
    }),
  ),
  topPages: z.array(
    z.object({
      pathGroup: z.string(),
      pageViews: z.number().int().nonnegative(),
      sessions: z.number().int().nonnegative(),
    }),
  ),
  devices: z.array(
    z.object({
      deviceCategory: z.enum(["mobile", "tablet", "desktop", "unknown"]),
      pageViews: z.number().int().nonnegative(),
      sessions: z.number().int().nonnegative(),
    }),
  ),
  recent: z.array(
    z.object({
      pathGroup: z.string(),
      deviceCategory: z.enum(["mobile", "tablet", "desktop", "unknown"]),
      createdAt: z.string(),
    }),
  ),
});

function rangeFromRequest(request: Request): number | null {
  const raw = new URL(request.url).searchParams.get("days");
  if (raw == null) return 30;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && allowedRanges.has(parsed) ? parsed : null;
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdminApiUser();
  if (!auth.ok) return auth.response;

  const days = rangeFromRequest(request);
  if (days == null) {
    return privateJson({ error: "Invalid analytics range" }, { status: 400 });
  }

  if (!getServerSupabaseConfig()?.serviceRoleKey) {
    return privateJson({
      configured: false,
      collectionEnabled:
        process.env.NEXT_PUBLIC_PRODUCT_ANALYTICS_ENABLED === "true",
      generatedAt: new Date().toISOString(),
      rangeDays: days,
      retentionDays: 90,
      timezone: "Asia/Tokyo",
    });
  }

  try {
    const supabase = createSupabaseServiceClient();
    await supabase.rpc("prune_web_analytics_page_views");
    const { data, error } = await supabase.rpc("get_web_analytics_summary", {
      p_days: days,
    });
    if (error) throw new Error(error.message);

    const parsed = summarySchema.safeParse(data);
    if (!parsed.success) {
      throw new Error("Invalid analytics summary");
    }

    return privateJson({
      configured: true,
      collectionEnabled:
        process.env.NEXT_PUBLIC_PRODUCT_ANALYTICS_ENABLED === "true",
      generatedAt: new Date().toISOString(),
      retentionDays: 90,
      timezone: "Asia/Tokyo",
      ...parsed.data,
    });
  } catch {
    return privateJson(
      { error: "アクセス解析を取得できませんでした。" },
      { status: 503 },
    );
  }
}
