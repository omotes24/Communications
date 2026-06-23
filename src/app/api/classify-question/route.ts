import { zodTextFormat } from "openai/helpers/zod";

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

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = classifyQuestionRequestSchema.parse(await request.json());
    const env = getServerEnv();

    if (body.speaker === "local") {
      return Response.json(mockClassifyQuestion(body));
    }

    if (env.AI_MOCK_MODE) {
      return Response.json(mockClassifyQuestion(body));
    }

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
      return jsonError("質問判定の解析に失敗しました", 502);
    }

    return Response.json(response.output_parsed);
  } catch (error) {
    return jsonError(toPublicError(error), 400);
  }
}
