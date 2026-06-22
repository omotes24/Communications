import { getServerEnv, assertOpenAIKey } from "@/lib/openai/env";
import { jsonError, toPublicError } from "@/lib/privacy/logging";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  try {
    const env = getServerEnv();
    if (env.OPENAI_MOCK_MODE) {
      return Response.json({
        value: "mock-ephemeral-token",
        model: env.OPENAI_TRANSCRIPTION_MODEL,
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${assertOpenAIKey(env)}`,
          "Content-Type": "application/json",
          "OpenAI-Safety-Identifier": "local-interview-assistant",
        },
        body: JSON.stringify({
          session: {
            type: "transcription",
            audio: {
              input: {
                transcription: {
                  model: env.OPENAI_TRANSCRIPTION_MODEL,
                  language: "ja",
                  delay: "low",
                },
                turn_detection: null,
              },
            },
          },
        }),
      },
    );

    if (!response.ok) {
      return jsonError("Realtime セッションの作成に失敗しました", 502);
    }

    return Response.json(await response.json());
  } catch (error) {
    return jsonError(toPublicError(error), 400);
  }
}
