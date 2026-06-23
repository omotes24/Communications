import { zodTextFormat } from "openai/helpers/zod";

import { createOpenAIClient } from "@/lib/openai/client";
import { getServerEnv } from "@/lib/openai/env";
import {
  buildInterviewLearningInput,
  INTERVIEW_LEARNING_INSTRUCTIONS,
} from "@/lib/prompts/interview-learning";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import {
  learnInterviewContextOutputSchema,
  learnInterviewContextRequestSchema,
} from "@/lib/schemas/interview";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = learnInterviewContextRequestSchema.parse(await request.json());
    const env = getServerEnv();

    if (env.AI_MOCK_MODE) {
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

    const client = createOpenAIClient();
    const response = await client.responses.parse(
      {
        model: env.RESEARCH_MODEL,
        instructions: INTERVIEW_LEARNING_INSTRUCTIONS,
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
      return jsonError("面接前学習メモの解析に失敗しました", 502);
    }

    return Response.json(response.output_parsed);
  } catch (error) {
    return jsonError(toPublicError(error), 400);
  }
}
