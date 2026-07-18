import { z } from "zod";

import { requireAdminApiUser } from "@/lib/auth/admin";
import { isInterviewExperienceEnabled } from "@/lib/features/server";
import { toPublicError } from "@/lib/privacy/logging";
import { privateJson, privateJsonError } from "@/lib/privacy/private-response";
import { saveInterviewExperienceRequestSchema } from "@/lib/schemas/interview-experience";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const auth = await requireAdminApiUser();
  if (!auth.ok) return auth.response;
  if (!isInterviewExperienceEnabled()) {
    return privateJson({ error: "Not found" }, { status: 404 });
  }
  if (!getServerSupabaseConfig()?.serviceRoleKey) {
    return privateJson({ items: [] });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("interview_experience_reports")
    .select(
      "id, interview_session_id, company_slot_id, jobtrack_catalog_ref, company_name_snapshot, interview_month, selection_stage, employment_type, interview_format, role_category, summary, overall_impression, difficulty, questions, insights, research_consent, review_status, created_at, updated_at",
    )
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return privateJsonError(toPublicError(error), 400);
  return privateJson({ items: data ?? [] });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAdminApiUser();
  if (!auth.ok) return auth.response;
  if (!isInterviewExperienceEnabled()) {
    return privateJson({ error: "Not found" }, { status: 404 });
  }
  if (!getServerSupabaseConfig()?.serviceRoleKey) {
    return privateJsonError(
      "面接体験レポートの保存設定が不足しています。",
      503,
    );
  }

  try {
    const body = saveInterviewExperienceRequestSchema.parse(
      await request.json(),
    );
    const supabase = createSupabaseServiceClient();
    const { data: session, error: sessionError } = await supabase
      .from("interview_sessions")
      .select("id, company_slot_id")
      .eq("id", body.sessionId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (sessionError) throw new Error(sessionError.message);
    if (!session) return privateJsonError("面接履歴が見つかりません。", 404);

    const companySlotId =
      body.companySlotId ??
      (session as { company_slot_id: string | null }).company_slot_id ??
      null;
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("interview_experience_reports")
      .upsert(
        {
          user_id: auth.user.id,
          interview_session_id: body.sessionId,
          company_slot_id: companySlotId,
          jobtrack_catalog_ref: body.jobtrackCatalogRef ?? null,
          company_name_snapshot: body.companyNameSnapshot,
          interview_month: body.interviewMonth ?? null,
          selection_stage: body.selectionStage,
          employment_type: body.employmentType,
          interview_format: body.interviewFormat,
          role_category: body.roleCategory,
          summary: body.draft.summary,
          overall_impression: body.draft.overallImpression,
          difficulty: body.draft.difficulty,
          questions: body.draft.questions,
          insights: body.draft.insights,
          source_message_count: body.sourceMessageCount,
          source_transcript_sha256: body.sourceTranscriptSha256,
          review_status: "reviewed",
          research_consent: body.researchConsent,
          consent_version: body.researchConsent
            ? (body.consentVersion ?? "yfy-research-v1")
            : null,
          contributed_at: body.researchConsent ? now : null,
        },
        { onConflict: "user_id,interview_session_id" },
      )
      .select("id, updated_at")
      .single();
    if (error) throw new Error(error.message);

    if (companySlotId && body.jobtrackCatalogRef) {
      const { error: companyError } = await supabase
        .from("company_slots")
        .update({ jobtrack_catalog_ref: body.jobtrackCatalogRef })
        .eq("id", companySlotId)
        .eq("user_id", auth.user.id);
      if (companyError) throw new Error(companyError.message);
    }

    return privateJson({ ok: true, report: data });
  } catch (error) {
    return privateJsonError(toPublicError(error), 400);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await requireAdminApiUser();
  if (!auth.ok) return auth.response;
  if (!isInterviewExperienceEnabled()) {
    return privateJson({ error: "Not found" }, { status: 404 });
  }
  const parsed = z
    .object({ reportId: z.string().uuid() })
    .safeParse(await request.json());
  if (!parsed.success) return privateJsonError("削除対象が不正です。", 400);

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("interview_experience_reports")
    .update({
      review_status: "withdrawn",
      research_consent: false,
      consent_version: null,
      contributed_at: null,
    })
    .eq("id", parsed.data.reportId)
    .eq("user_id", auth.user.id);
  if (error) return privateJsonError(toPublicError(error), 400);
  return privateJson({ ok: true });
}
