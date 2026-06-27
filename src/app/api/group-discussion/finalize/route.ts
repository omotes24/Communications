import { zodTextFormat } from "openai/helpers/zod";

import { requireApiUser } from "@/lib/auth/server";
import { createMockFinalEvaluation } from "@/lib/group-discussion/mock";
import { createOpenAIClient } from "@/lib/openai/client";
import { getServerEnv } from "@/lib/openai/env";
import { buildGroupDiscussionFinalPrompt } from "@/lib/prompts/group-discussion";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import {
  groupDiscussionFinalizeOutputSchema,
  groupDiscussionFinalizeRequestSchema,
} from "@/lib/schemas/groupDiscussion";
import { estimateGroupDiscussionFinalizeTokens } from "@/lib/tokens/ai-estimates";
import {
  createRequestIds,
  releaseAiTokenReservation,
  reserveAiTokens,
  settleAiTokens,
  TokenBalanceError,
} from "@/lib/tokens/service";
import { extractOpenAIUsage } from "@/lib/tokens/usage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = groupDiscussionFinalizeRequestSchema.parse(await request.json());
    const env = getServerEnv();
    const { requestId, operationId } = createRequestIds(request);
    const reservation = await reserveAiTokens({
      userId: auth.user.id,
      requestId,
      operationId,
      feature: "group-discussion",
      provider: env.AI_PROVIDER,
      model: env.GROUP_DISCUSSION_MODEL,
      estimatedAmount: estimateGroupDiscussionFinalizeTokens(body),
      metadata: { route: "group-discussion-finalize" },
    });

    if (env.AI_MOCK_MODE || env.OPENAI_GD_MOCK_MODE) {
      const output = createMockFinalEvaluation(body.session);
      await settleAiTokens(reservation, {
        inputTokens: 1200,
        outputTokens: 1800,
      });
      return Response.json(output);
    }

    try {
      const client = createOpenAIClient({ timeoutMs: 55_000 });
      const response = await client.responses.parse(
        {
          model: env.GROUP_DISCUSSION_MODEL,
          input: buildGroupDiscussionFinalPrompt(body),
          text: {
            format: zodTextFormat(
              groupDiscussionFinalizeOutputSchema,
              "group_discussion_final",
            ),
          },
          store: false,
        },
        { signal: request.signal },
      );
      if (!response.output_parsed) {
        await releaseAiTokenReservation(reservation, "parse_failed");
        return jsonError("GD最終評価に失敗しました。", 502);
      }
      await settleAiTokens(reservation, extractOpenAIUsage(response));
      return Response.json(response.output_parsed);
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
