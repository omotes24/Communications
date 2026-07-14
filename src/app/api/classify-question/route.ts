import { zodTextFormat } from "openai/helpers/zod";

import { requireApiUser } from "@/lib/auth/server";
import { createOpenAIClient } from "@/lib/openai/client";
import { getServerEnv } from "@/lib/openai/env";
import {
  QUESTION_CLASSIFIER_INSTRUCTIONS,
  buildQuestionClassifierInput,
} from "@/lib/prompts/classifier";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import {
  classifyQuestionRequestSchema,
  questionClassificationSchema,
} from "@/lib/schemas/interview";
import { mockClassifyQuestion } from "@/lib/test/mock-openai";
import { estimateClassifyTokens } from "@/lib/tokens/ai-estimates";
import { adjustTextReservationForModel } from "@/lib/tokens/model-rates";
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
    const body = classifyQuestionRequestSchema.parse(await request.json());
    const env = getServerEnv();

    if (body.speaker === "local") {
      return Response.json(mockClassifyQuestion(body));
    }

    const { requestId, operationId } = createRequestIds(request);
    const reservation = await reserveAiTokens({
      userId: auth.user.id,
      requestId,
      operationId,
      feature: "classify-question",
      provider: env.AI_PROVIDER,
      model: env.CLASSIFIER_MODEL,
      estimatedAmount: adjustTextReservationForModel(
        env.CLASSIFIER_MODEL,
        estimateClassifyTokens(body),
      ),
    });

    if (env.AI_MOCK_MODE) {
      await settleAiTokens(reservation, {
        inputTokens: Math.ceil(body.transcript.length / 3),
        outputTokens: 80,
      });
      return Response.json(mockClassifyQuestion(body));
    }

    try {
      const client = createOpenAIClient();
      const response = await client.responses.parse(
        {
          model: env.CLASSIFIER_MODEL,
          instructions: QUESTION_CLASSIFIER_INSTRUCTIONS,
          input: buildQuestionClassifierInput(body),
          text: {
            format: zodTextFormat(
              questionClassificationSchema,
              "question_classification",
            ),
          },
          store: false,
        },
        { signal: request.signal },
      );

      if (!response.output_parsed) {
        await releaseAiTokenReservation(reservation, "parse_failed");
        return jsonError("質問判定の解析に失敗しました", 502);
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
