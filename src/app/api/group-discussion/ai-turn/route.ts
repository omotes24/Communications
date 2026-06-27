import { zodTextFormat } from "openai/helpers/zod";

import { requireApiUser } from "@/lib/auth/server";
import { analyzeGroupDiscussionUtterance } from "@/lib/group-discussion/analysis";
import { createMockAiTurn } from "@/lib/group-discussion/mock";
import { createOpenAIClient } from "@/lib/openai/client";
import { getServerEnv } from "@/lib/openai/env";
import { buildGroupDiscussionAiTurnPrompt } from "@/lib/prompts/group-discussion";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import {
  groupDiscussionAiTurnDraftSchema,
  groupDiscussionAiTurnRequestSchema,
  type GroupDiscussionParticipant,
  type GroupDiscussionUtterance,
} from "@/lib/schemas/groupDiscussion";
import { estimateGroupDiscussionAiTurnTokens } from "@/lib/tokens/ai-estimates";
import {
  createRequestIds,
  releaseAiTokenReservation,
  reserveAiTokens,
  settleAiTokens,
  TokenBalanceError,
} from "@/lib/tokens/service";
import { extractOpenAIUsage } from "@/lib/tokens/usage";

export const dynamic = "force-dynamic";

function resolveParticipant(
  participants: GroupDiscussionParticipant[],
  speakerId: string,
): GroupDiscussionParticipant {
  return (
    participants.find(
      (participant) => participant.id === speakerId && participant.type === "ai",
    ) ??
    participants.find((participant) => participant.type === "ai") ?? {
      id: "ai-facilitator",
      name: "AI 進行役",
      role: "議論整理",
      stance: "論点と時間を整理する",
      type: "ai",
    }
  );
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = groupDiscussionAiTurnRequestSchema.parse(await request.json());
    const env = getServerEnv();
    const { requestId, operationId } = createRequestIds(request);
    const reservation = await reserveAiTokens({
      userId: auth.user.id,
      requestId,
      operationId,
      feature: "group-discussion",
      provider: env.AI_PROVIDER,
      model: env.GROUP_DISCUSSION_MODEL,
      estimatedAmount: estimateGroupDiscussionAiTurnTokens(body),
      metadata: { route: "group-discussion-ai-turn" },
    });

    if (env.AI_MOCK_MODE || env.OPENAI_GD_MOCK_MODE) {
      const output = createMockAiTurn(body.session);
      await settleAiTokens(reservation, {
        inputTokens: 500,
        outputTokens: Math.ceil(output.utterance.text.length / 3),
      });
      return Response.json(output);
    }

    try {
      const client = createOpenAIClient();
      const response = await client.responses.parse(
        {
          model: env.GROUP_DISCUSSION_MODEL,
          input: buildGroupDiscussionAiTurnPrompt(body),
          text: {
            format: zodTextFormat(
              groupDiscussionAiTurnDraftSchema,
              "group_discussion_ai_turn",
            ),
          },
          store: false,
        },
        { signal: request.signal },
      );
      if (!response.output_parsed) {
        await releaseAiTokenReservation(reservation, "parse_failed");
        return jsonError("AI参加者の発言生成に失敗しました。", 502);
      }
      const participant = resolveParticipant(
        body.session.participants,
        response.output_parsed.speakerId,
      );
      const now = new Date().toISOString();
      const utterance: GroupDiscussionUtterance = {
        id: `gd-ai-${crypto.randomUUID()}`,
        sessionId: body.session.id,
        speakerId: participant.id,
        speakerName: participant.name,
        speakerType: "ai",
        text: response.output_parsed.text,
        source: "ai",
        startedAt: now,
        endedAt: now,
        durationSeconds: Math.max(
          3,
          Math.ceil(response.output_parsed.text.length / 12),
        ),
        analysis: analyzeGroupDiscussionUtterance({
          text: response.output_parsed.text,
        }),
      };
      await settleAiTokens(reservation, extractOpenAIUsage(response));
      return Response.json({ utterance });
    } catch (error) {
      await releaseAiTokenReservation(reservation, "api_failed");
      throw error;
    }
  } catch (error) {
    if (error instanceof TokenBalanceError) {
      return jsonError(error.message, error.status);
    }
    return jsonError(toPublicError(error), 400);
  }
}
