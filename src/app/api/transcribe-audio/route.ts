import { createOpenAIClient } from "@/lib/openai/client";
import { getServerEnv } from "@/lib/openai/env";
import { jsonError, toPublicError } from "@/lib/privacy/logging";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const env = getServerEnv();
    const formData = await request.formData();
    const audio = formData.get("audio");
    if (!(audio instanceof File)) {
      return jsonError("音声ファイルが送信されていません", 400);
    }

    if (env.AI_MOCK_MODE) {
      return Response.json({
        text: "モックモードでは実音声の文字起こしは行いません。手動入力を使用してください。",
      });
    }

    const client = createOpenAIClient();
    const transcription = await client.audio.transcriptions.create({
      file: audio,
      model: env.TRANSCRIPTION_MODEL,
      language: "ja",
    });

    return Response.json({ text: transcription.text ?? "" });
  } catch (error) {
    return jsonError(toPublicError(error), 400);
  }
}
