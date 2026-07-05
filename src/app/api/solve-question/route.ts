import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInput } from "openai/resources/responses/responses";

import { requireApiUser } from "@/lib/auth/server";
import { createOpenAIClient } from "@/lib/openai/client";
import { getServerEnv } from "@/lib/openai/env";
import {
  QUESTION_SOLVER_INSTRUCTIONS,
  VISUAL_EXTRACTION_INSTRUCTIONS,
  buildQuestionSolverInput,
  buildVisualExtractionInput,
  createMockSolvedQuestion,
  formatVisualExtraction,
} from "@/lib/question-solver/prompts";
import {
  solvedQuestionSchema,
  type SolveQuestionRequest,
  solveQuestionRequestSchema,
  visualExtractionSchema,
} from "@/lib/question-solver/schemas";
import { toPublicError } from "@/lib/privacy/logging";
import { estimateSolveQuestionTokens } from "@/lib/tokens/ai-estimates";
import {
  createRequestIds,
  releaseAiTokenReservation,
  reserveAiTokens,
  settleAiTokens,
  TokenBalanceError,
} from "@/lib/tokens/service";
import { extractOpenAIUsage, type UsageParts } from "@/lib/tokens/usage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") ?? "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const allowed =
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:") ||
    (siteUrl ? origin === siteUrl : false);

  if (!allowed) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, X-Request-Id, X-Operation-Id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonWithCors(
  request: Request,
  body: unknown,
  init?: ResponseInit,
): Response {
  return Response.json(body, {
    ...init,
    headers: {
      ...corsHeaders(request),
      ...init?.headers,
    },
  });
}

function addUsageParts(...partsList: UsageParts[]): UsageParts {
  return partsList.reduce<UsageParts>((total, parts) => {
    total.inputTokens = (total.inputTokens ?? 0) + (parts.inputTokens ?? 0);
    total.cachedInputTokens =
      (total.cachedInputTokens ?? 0) + (parts.cachedInputTokens ?? 0);
    total.outputTokens = (total.outputTokens ?? 0) + (parts.outputTokens ?? 0);
    total.reasoningTokens =
      (total.reasoningTokens ?? 0) + (parts.reasoningTokens ?? 0);
    total.audioSeconds = (total.audioSeconds ?? 0) + (parts.audioSeconds ?? 0);
    total.webSearchCalls =
      (total.webSearchCalls ?? 0) + (parts.webSearchCalls ?? 0);
    return total;
  }, {});
}

function buildOpenAIInput(
  body: SolveQuestionRequest,
  extractedVisualContext?: string,
): string | ResponseInput {
  const inputText = buildQuestionSolverInput(body, {
    extractedVisualContext,
  });
  const imageUrl = body.question.visualImageDataUrl;

  if (!imageUrl) {
    return inputText;
  }

  return [
    {
      role: "user",
      content: [
        { type: "input_text", text: inputText },
        {
          type: "input_image",
          image_url: imageUrl,
          detail: "high",
        },
      ],
    },
  ];
}

function buildVisualExtractionOpenAIInput(
  body: SolveQuestionRequest,
): string | ResponseInput {
  const imageUrl = body.question.visualImageDataUrl;
  if (!imageUrl) {
    return buildVisualExtractionInput(body.question);
  }

  return [
    {
      role: "user",
      content: [
        { type: "input_text", text: buildVisualExtractionInput(body.question) },
        {
          type: "input_image",
          image_url: imageUrl,
          detail: "high",
        },
      ],
    },
  ];
}

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return jsonWithCors(
      request,
      { error: "ログインが必要です。" },
      { status: 401 },
    );
  }

  try {
    const body = solveQuestionRequestSchema.parse(await request.json());
    const env = getServerEnv();
    const model = env.QUESTION_SOLVER_MODEL;
    const { requestId, operationId } = createRequestIds(request);
    const reservation = await reserveAiTokens({
      userId: auth.user.id,
      requestId,
      operationId,
      feature: "solve-question",
      provider: env.AI_PROVIDER,
      model,
      estimatedAmount: estimateSolveQuestionTokens(body),
      metadata: {
        route: "solve-question",
        source: body.question.source,
        mode: body.mode,
      },
    });

    if (env.AI_MOCK_MODE) {
      const solved = createMockSolvedQuestion(body);
      await settleAiTokens(reservation, {
        inputTokens: Math.ceil(JSON.stringify(body.question).length / 3),
        outputTokens: Math.ceil(JSON.stringify(solved).length / 3),
      });
      return jsonWithCors(request, solved);
    }

    try {
      const client = createOpenAIClient({ timeoutMs: 85_000 });
      let usageParts: UsageParts = {};
      let extractedVisualContext: string | undefined;

      if (body.question.visualImageDataUrl) {
        const visualResponse = await client.responses.parse(
          {
            model,
            instructions: VISUAL_EXTRACTION_INSTRUCTIONS,
            input: buildVisualExtractionOpenAIInput(body),
            text: {
              format: zodTextFormat(
                visualExtractionSchema,
                "visual_extraction",
              ),
            },
            store: false,
          },
          { signal: request.signal },
        );

        usageParts = addUsageParts(
          usageParts,
          extractOpenAIUsage(visualResponse),
        );

        if (visualResponse.output_parsed) {
          extractedVisualContext = formatVisualExtraction(
            visualResponse.output_parsed,
          );
        }
      }

      const response = await client.responses.parse(
        {
          model,
          instructions: QUESTION_SOLVER_INSTRUCTIONS,
          input: buildOpenAIInput(body, extractedVisualContext),
          text: {
            format: zodTextFormat(solvedQuestionSchema, "solved_question"),
          },
          store: false,
        },
        { signal: request.signal },
      );

      if (!response.output_parsed) {
        await releaseAiTokenReservation(reservation, "parse_failed");
        return jsonWithCors(
          request,
          { error: "解答JSONの解析に失敗しました。" },
          { status: 502 },
        );
      }

      usageParts = addUsageParts(usageParts, extractOpenAIUsage(response));
      await settleAiTokens(reservation, usageParts);
      return jsonWithCors(request, response.output_parsed);
    } catch (error) {
      await releaseAiTokenReservation(reservation, "api_failed");
      throw error;
    }
  } catch (error) {
    if (error instanceof TokenBalanceError) {
      return jsonWithCors(
        request,
        { error: error.message },
        { status: error.status },
      );
    }
    return jsonWithCors(request, { error: toPublicError(error) }, { status: 400 });
  }
}
