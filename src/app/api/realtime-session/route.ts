import { requireApiUser } from "@/lib/auth/server";
import { getServerEnv, assertOpenAIKey } from "@/lib/openai/env";
import { japaneseInterviewTranscriptionPrompt } from "@/lib/openai/transcription";
import { isRealtimeTranscriptionDelay } from "@/lib/openai/transcription-delay";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import { estimateRealtimeSessionTokens } from "@/lib/tokens/ai-estimates";
import {
  createRequestIds,
  releaseAiTokenReservation,
  reserveAiTokens,
  settleAiTokens,
  TokenBalanceError,
} from "@/lib/tokens/service";

export const dynamic = "force-dynamic";

async function readRequestedTranscriptionDelay(
  request: Request,
): Promise<string | null> {
  const body = (await request.json().catch(() => null)) as {
    transcriptionDelay?: unknown;
  } | null;
  const requestedDelay = body?.transcriptionDelay;
  return isRealtimeTranscriptionDelay(requestedDelay) ? requestedDelay : null;
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const env = getServerEnv();
    const requestedTranscriptionDelay =
      await readRequestedTranscriptionDelay(request);
    const reservedSeconds = Number(
      process.env.APP_REALTIME_SESSION_RESERVATION_SECONDS ?? 180,
    );
    const transcriptionConfig = {
      model: env.TRANSCRIPTION_MODEL,
      language: "ja",
      ...(env.TRANSCRIPTION_MODEL === "gpt-realtime-whisper"
        ? {
            delay:
              requestedTranscriptionDelay ?? env.OPENAI_TRANSCRIPTION_DELAY,
          }
        : {}),
    };
    const noiseReductionConfig =
      env.OPENAI_AUDIO_NOISE_REDUCTION === "off"
        ? null
        : { type: env.OPENAI_AUDIO_NOISE_REDUCTION };
    const { requestId, operationId } = createRequestIds(request);
    const reservation = await reserveAiTokens({
      userId: auth.user.id,
      requestId,
      operationId,
      feature: "realtime-session",
      provider: env.AI_PROVIDER,
      model: env.TRANSCRIPTION_MODEL,
      estimatedAmount: estimateRealtimeSessionTokens(reservedSeconds),
    });

    if (env.AI_MOCK_MODE) {
      await settleAiTokens(reservation, { audioSeconds: reservedSeconds });
      return Response.json({
        value: "mock-ephemeral-token",
        model: env.TRANSCRIPTION_MODEL,
        provider: env.AI_PROVIDER,
        reservationExpiresAt: reservation.expiresAt,
        reservationSeconds: reservedSeconds,
      });
    }

    if (env.AI_PROVIDER === "groq") {
      await settleAiTokens(reservation, { audioSeconds: reservedSeconds });
      return Response.json({
        value: "groq-chunked-transcription",
        model: env.TRANSCRIPTION_MODEL,
        provider: "groq",
        reservationExpiresAt: reservation.expiresAt,
        reservationSeconds: reservedSeconds,
      });
    }

    try {
      const createClientSecret = (options: { includePrompt: boolean }) =>
        fetch("https://api.openai.com/v1/realtime/client_secrets", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${assertOpenAIKey(env)}`,
            "Content-Type": "application/json",
            "OpenAI-Safety-Identifier": "local-interview-assistant",
          },
          body: JSON.stringify({
            expires_after: {
              anchor: "created_at",
              seconds: Math.max(10, Math.min(reservedSeconds, 7200)),
            },
            session: {
              type: "transcription",
              audio: {
                input: {
                  noise_reduction: noiseReductionConfig,
                  transcription: {
                    ...transcriptionConfig,
                    ...(options.includePrompt
                      ? { prompt: japaneseInterviewTranscriptionPrompt }
                      : {}),
                  },
                  turn_detection: null,
                },
              },
            },
          }),
        });
      let response = await createClientSecret({ includePrompt: true });
      if (!response.ok) {
        response = await createClientSecret({ includePrompt: false });
      }

      if (!response.ok) {
        await releaseAiTokenReservation(reservation, "realtime_failed");
        return jsonError("Realtime セッションの作成に失敗しました", 502);
      }

      await settleAiTokens(reservation, { audioSeconds: reservedSeconds });
      return Response.json({
        ...(await response.json()),
        reservationExpiresAt: reservation.expiresAt,
        reservationSeconds: reservedSeconds,
      });
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
