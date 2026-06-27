import { zodTextFormat } from "openai/helpers/zod";

import { createOpenAIClient } from "@/lib/openai/client";
import { getServerEnv } from "@/lib/openai/env";
import { buildGroupDiscussionTopicPrompt } from "@/lib/prompts/group-discussion";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import {
  groupDiscussionTopicOutputSchema,
  groupDiscussionTopicRequestSchema,
} from "@/lib/schemas/groupDiscussion";
import { requireApiUser } from "@/lib/auth/server";
import { createMockGroupDiscussionTopic } from "@/lib/group-discussion/mock";
import { estimateGroupDiscussionTopicTokens } from "@/lib/tokens/ai-estimates";
import {
  createRequestIds,
  releaseAiTokenReservation,
  reserveAiTokens,
  settleAiTokens,
  TokenBalanceError,
} from "@/lib/tokens/service";
import { extractOpenAIUsage } from "@/lib/tokens/usage";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = groupDiscussionTopicRequestSchema.parse(await request.json());
    const env = getServerEnv();
    const { requestId, operationId } = createRequestIds(request);
    const reservation = await reserveAiTokens({
      userId: auth.user.id,
      requestId,
      operationId,
      feature: "group-discussion",
      provider: env.AI_PROVIDER,
      model: env.GROUP_DISCUSSION_MODEL,
      estimatedAmount: estimateGroupDiscussionTopicTokens(body),
      metadata: { route: "group-discussion-topic" },
    });

    if (env.AI_MOCK_MODE || env.OPENAI_GD_MOCK_MODE) {
      const topic = createMockGroupDiscussionTopic(body);
      await settleAiTokens(reservation, {
        inputTokens: 320,
        outputTokens: 420,
      });
      return Response.json(topic);
    }

    try {
      const client = createOpenAIClient();
      const response = await client.responses.parse(
        {
          model: env.GROUP_DISCUSSION_MODEL,
          input: buildGroupDiscussionTopicPrompt(body),
          text: {
            format: zodTextFormat(
              groupDiscussionTopicOutputSchema,
              "group_discussion_topic",
            ),
          },
          store: false,
        },
        { signal: request.signal },
      );
      if (!response.output_parsed) {
        await releaseAiTokenReservation(reservation, "parse_failed");
        return jsonError("GDテーマ生成に失敗しました。", 502);
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
