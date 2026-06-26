import { zodTextFormat } from "openai/helpers/zod";

import { requireApiUser } from "@/lib/auth/server";
import { createOpenAIClient } from "@/lib/openai/client";
import { getServerEnv, structuredOutputModel } from "@/lib/openai/env";
import {
  buildInterviewLearningInstructions,
  buildInterviewLearningInput,
} from "@/lib/prompts/interview-learning";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import {
  learnInterviewContextOutputSchema,
  learnInterviewContextRequestSchema,
} from "@/lib/schemas/interview";
import { estimateLearningTokens } from "@/lib/tokens/ai-estimates";
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
    const body = learnInterviewContextRequestSchema.parse(await request.json());
    const env = getServerEnv();
    const model = structuredOutputModel(env);
    const { requestId, operationId } = createRequestIds(request);
    const reservation = await reserveAiTokens({
      userId: auth.user.id,
      requestId,
      operationId,
      feature: "learn-interview-context",
      provider: env.AI_PROVIDER,
      model,
      estimatedAmount: estimateLearningTokens(body),
    });

    if (env.AI_MOCK_MODE) {
      await settleAiTokens(reservation, {
        inputTokens: 400,
        outputTokens: 260,
      });
      if (body.learningLanguage === "en") {
        return Response.json({
          brief:
            "Use the SatoFC field implementation experience as the main storyline: the user did not stop at research, but translated technology into a tool that could support real decisions in the field. Connect this to the target role through problem discovery, stakeholder coordination, safe AI design, and continuous operational improvement.",
          keyPoints: [
            "End-to-end experience from stakeholder interviews to development, deployment, and operational improvement",
            "Safety-oriented AI design that rejects unknown species as Unknown instead of forcing a false label",
            "Consensus-building experience that clarified local government concerns and led to field validation support",
          ],
          caution:
            "Only refer to company programs, assignments, or hiring details that are present in the registered company information.",
        });
      }
      return Response.json({
        brief:
          "SatoFCの現場実装経験を中心に、技術を研究で終わらせず現場の意思決定に使える形へ変換した点を軸に回答する。企業・志望コースに対しては、課題ヒアリング、関係者調整、安全なAI設計、継続運用を見据えた改善経験を接続する。",
        keyPoints: [
          "SatoFCでのヒアリングから開発・デプロイ・運用改善までの一貫経験",
          "未知種をUnknownとして棄却する安全性重視のAI設計",
          "自治体の不安を整理し、実証協力につなげた合意形成経験",
        ],
        caution:
          "企業側の具体的な制度や配属内容は、調査で確認できた範囲だけに留める。",
      });
    }

    try {
      const client = createOpenAIClient();
      const response = await client.responses.parse(
        {
          model,
          instructions: buildInterviewLearningInstructions(
            body.learningLanguage,
          ),
          input: buildInterviewLearningInput(body),
          text: {
            format: zodTextFormat(
              learnInterviewContextOutputSchema,
              "interview_learning",
            ),
          },
          store: false,
        },
        { signal: request.signal },
      );

      if (!response.output_parsed) {
        await releaseAiTokenReservation(reservation, "parse_failed");
        return jsonError("面接前学習メモの解析に失敗しました", 502);
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
