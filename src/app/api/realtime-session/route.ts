import { requireApiUser } from "@/lib/auth/server";
import { getServerEnv, assertOpenAIKey } from "@/lib/openai/env";
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

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const env = getServerEnv();
    const reservedSeconds = Number(
      process.env.APP_REALTIME_SESSION_RESERVATION_SECONDS ?? 180,
    );
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
            expires_after: {
              anchor: "created_at",
              seconds: Math.max(10, Math.min(reservedSeconds, 7200)),
            },
            session: {
              type: "transcription",
              audio: {
                input: {
                  transcription: {
                    model: env.TRANSCRIPTION_MODEL,
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
