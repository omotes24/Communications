import { createHash } from "node:crypto";

import { zodTextFormat } from "openai/helpers/zod";

import { requireAdminApiUser } from "@/lib/auth/admin";
import { isInterviewExperienceEnabled } from "@/lib/features/server";
import { createOpenAIClient } from "@/lib/openai/client";
import { getServerEnv, structuredOutputModel } from "@/lib/openai/env";
import { toPublicError } from "@/lib/privacy/logging";
import { privateJson, privateJsonError } from "@/lib/privacy/private-response";
import {
  generateInterviewExperienceRequestSchema,
  interviewExperienceDraftSchema,
} from "@/lib/schemas/interview-experience";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getServerSupabaseConfig } from "@/lib/supabase/server-config";
import {
  createRequestIds,
  releaseAiTokenReservation,
  reserveAiTokens,
  settleAiTokens,
  TokenBalanceError,
} from "@/lib/tokens/service";
import { adjustTextReservationForModel } from "@/lib/tokens/model-rates";
import { calculateAppTokens, extractOpenAIUsage } from "@/lib/tokens/usage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SessionRow = {
  id: string;
  company_slot_id: string | null;
  title: string;
  started_at: string | null;
};
type MessageRow = {
  role: string;
  message_type: string;
  content: string;
  created_at: string;
};
type CompanyRow = {
  company_name: string;
  jobtrack_catalog_ref: string | null;
};

const instructions = `You normalize a Japanese job-interview transcript into a privacy-safe experience report and past-question bank.
Return Japanese structured data only.

Rules:
- Extract only questions that an interviewer actually appears to ask. Do not invent questions.
- Rewrite questions minimally so names, schools, addresses, phone numbers, emails, account IDs, and other personal identifiers are removed.
- Never copy the candidate's answer into question, summary, or insights.
- Do not include confidential company information, meeting URLs, interviewer names, or contact details.
- If the transcript is ambiguous, omit the item and add a privacy warning.
- The summary describes the interview flow and atmosphere, not the candidate's personal story.
- answerPreparationHint must be general preparation advice, never a model answer copied from this candidate.
- difficulty is 1 to 5, or null if there is insufficient evidence.`;

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
    const body = generateInterviewExperienceRequestSchema.parse(
      await request.json(),
    );
    const supabase = createSupabaseServiceClient();
    const { data: sessionData, error: sessionError } = await supabase
      .from("interview_sessions")
      .select("id, company_slot_id, title, started_at")
      .eq("id", body.sessionId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (sessionError) throw new Error(sessionError.message);
    if (!sessionData) {
      return privateJsonError("面接履歴が見つかりません。", 404);
    }
    const session = sessionData as SessionRow;

    const { data: messageData, error: messageError } = await supabase
      .from("interview_messages")
      .select("role, message_type, content, created_at")
      .eq("session_id", body.sessionId)
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: true })
      .limit(500);
    if (messageError) throw new Error(messageError.message);
    const messages = (messageData ?? []) as MessageRow[];
    if (!messages.length) {
      return privateJsonError("文字起こしがまだありません。", 400);
    }

    let company: CompanyRow | null = null;
    if (session.company_slot_id) {
      const { data } = await supabase
        .from("company_slots")
        .select("company_name, jobtrack_catalog_ref")
        .eq("id", session.company_slot_id)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      company = data as CompanyRow | null;
    }

    const transcript = messages
      .map(
        (message) =>
          `[${message.role}/${message.message_type}] ${String(message.content).slice(0, 4000)}`,
      )
      .join("\n")
      .slice(0, 60_000);
    const sourceTranscriptSha256 = createHash("sha256")
      .update(transcript)
      .digest("hex");
    const env = getServerEnv();
    const model = structuredOutputModel(env);
    const { requestId, operationId } = createRequestIds(request);
    const reservation = await reserveAiTokens({
      userId: auth.user.id,
      requestId,
      operationId,
      feature: "summarize-interview-experience",
      provider: env.AI_PROVIDER,
      model,
      estimatedAmount: adjustTextReservationForModel(
        model,
        calculateAppTokens({
          inputTokens: Math.ceil(transcript.length / 3),
          outputTokens: 2_000,
        }),
      ),
    });

    if (env.AI_MOCK_MODE) {
      const draft = interviewExperienceDraftSchema.parse({
        summary: "面接の流れと質問を、個人情報を除いて確認できるレポートです。",
        overallImpression: "対話形式で、経験と志望理由を確認する構成でした。",
        difficulty: 3,
        questions: [
          {
            question: "志望理由を教えてください。",
            category: "motivation",
            interviewerIntent: "企業理解と応募理由の一貫性を確認するため。",
            answerPreparationHint: "企業の特徴と自分の経験の接点を整理する。",
          },
        ],
        insights: ["結論から簡潔に話せるよう準備する。"],
        privacyWarnings: [],
      });
      await settleAiTokens(reservation, {
        inputTokens: 600,
        outputTokens: 300,
      });
      return privateJson({
        draft,
        sessionId: session.id,
        companySlotId: session.company_slot_id,
        companyNameSnapshot: company?.company_name ?? "",
        jobtrackCatalogRef:
          body.jobtrackCatalogRef ?? company?.jobtrack_catalog_ref ?? null,
        sourceMessageCount: messages.length,
        sourceTranscriptSha256,
      });
    }

    try {
      const client = createOpenAIClient();
      const response = await client.responses.parse(
        {
          model,
          instructions,
          input: [
            `会社: ${company?.company_name || "未設定"}`,
            `JobTrack非公開カタログ参照: ${body.jobtrackCatalogRef ?? company?.jobtrack_catalog_ref ?? "未設定"}`,
            `選考段階: ${body.selectionStage}`,
            `対象職種カテゴリ: ${body.roleCategory || "未設定"}`,
            `面接月: ${body.interviewMonth || "未設定"}`,
            "以下は非公開の文字起こしです。個人情報を除き、回答本文を再利用せずに正規化してください。",
            transcript,
          ].join("\n\n"),
          text: {
            format: zodTextFormat(
              interviewExperienceDraftSchema,
              "interview_experience",
            ),
          },
          store: false,
        },
        { signal: request.signal },
      );
      if (!response.output_parsed) {
        await releaseAiTokenReservation(reservation, "parse_failed");
        return privateJsonError(
          "面接体験レポートを解析できませんでした。",
          502,
        );
      }
      await settleAiTokens(reservation, extractOpenAIUsage(response));
      return privateJson({
        draft: response.output_parsed,
        sessionId: session.id,
        companySlotId: session.company_slot_id,
        companyNameSnapshot: company?.company_name ?? "",
        jobtrackCatalogRef:
          body.jobtrackCatalogRef ?? company?.jobtrack_catalog_ref ?? null,
        sourceMessageCount: messages.length,
        sourceTranscriptSha256,
      });
    } catch (error) {
      await releaseAiTokenReservation(reservation, "api_failed");
      throw error;
    }
  } catch (error) {
    if (error instanceof TokenBalanceError) {
      return privateJsonError(error.message, error.status);
    }
    return privateJsonError(toPublicError(error), 400);
  }
}
