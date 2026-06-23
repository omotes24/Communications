import { zodTextFormat } from "openai/helpers/zod";

import { createOpenAIClient } from "@/lib/openai/client";
import { getServerEnv } from "@/lib/openai/env";
import { extractPartialAnswer } from "@/lib/openai/partial-json";
import { encodeSse } from "@/lib/openai/sse";
import {
  buildAnswerInput,
  buildAnswerInstructions,
} from "@/lib/prompts/answer";
import { toPublicError } from "@/lib/privacy/logging";
import {
  answerDraftSchema,
  generateAnswerRequestSchema,
  validateAnswerLength,
} from "@/lib/schemas/interview";
import { mockGenerateAnswer, streamMockAnswer } from "@/lib/test/mock-openai";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const parsed = generateAnswerRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "回答生成リクエストが不正です" },
      { status: 400 },
    );
  }

  const env = getServerEnv();
  const body = parsed.data;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encodeSse(event, data));
      };

      try {
        send("status", { message: "回答案を生成しています" });

        if (env.AI_MOCK_MODE) {
          const draft = mockGenerateAnswer(body);
          for await (const partial of streamMockAnswer(draft)) {
            send("partial", partial);
          }
          send("done", {
            draft,
            length: validateAnswerLength(draft.answer),
          });
          controller.close();
          return;
        }

        const client = createOpenAIClient();
        const responseStream = client.responses.stream(
          {
            model: env.ANSWER_MODEL,
            instructions: buildAnswerInstructions(),
            input: buildAnswerInput(body),
            text: {
              format: zodTextFormat(answerDraftSchema, "answer_draft"),
              verbosity: "low",
            },
            store: false,
          },
          { signal: request.signal },
        );

        let buffer = "";
        for await (const event of responseStream) {
          if (event.type === "response.output_text.delta") {
            buffer += event.delta;
            send("partial", extractPartialAnswer(buffer));
          }
        }

        const finalResponse = await responseStream.finalResponse();
        const draft =
          finalResponse.output_parsed ??
          answerDraftSchema.parse(JSON.parse(buffer));
        send("done", {
          draft,
          length: validateAnswerLength(draft.answer),
        });
        controller.close();
      } catch (error) {
        send("error", { error: toPublicError(error) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/event-stream; charset=utf-8",
      Connection: "keep-alive",
    },
  });
}
