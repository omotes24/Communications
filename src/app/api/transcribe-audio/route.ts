import { requireApiUser } from "@/lib/auth/server";
import { createOpenAIClient } from "@/lib/openai/client";
import { getServerEnv } from "@/lib/openai/env";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import { estimateAudioTokens } from "@/lib/tokens/ai-estimates";
import {
  createRequestIds,
  releaseAiTokenReservation,
  reserveAiTokens,
  settleAiTokens,
  TokenBalanceError,
} from "@/lib/tokens/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const env = getServerEnv();
    const formData = await request.formData();
    const audio = formData.get("audio");
    if (!(audio instanceof File)) {
      return jsonError("音声ファイルが送信されていません", 400);
    }
    const { requestId, operationId } = createRequestIds(request);
    const estimate = estimateAudioTokens(audio);
    const reservation = await reserveAiTokens({
      userId: auth.user.id,
      requestId,
      operationId,
      feature: "transcribe-audio",
      provider: env.AI_PROVIDER,
      model: env.TRANSCRIPTION_MODEL,
      estimatedAmount: estimate.amount,
      metadata: { audioBytes: audio.size },
    });

    if (env.AI_MOCK_MODE) {
      await settleAiTokens(reservation, { audioSeconds: estimate.audioSeconds });
      return Response.json({
        text: "モックモードでは実音声の文字起こしは行いません。手動入力を使用してください。",
      });
    }

    try {
      const client = createOpenAIClient();
      const transcription = await client.audio.transcriptions.create({
        file: audio,
        model: env.TRANSCRIPTION_MODEL,
        language: "ja",
      });

      await settleAiTokens(reservation, { audioSeconds: estimate.audioSeconds });
      return Response.json({ text: transcription.text ?? "" });
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
