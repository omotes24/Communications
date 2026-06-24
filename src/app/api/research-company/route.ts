import { zodTextFormat } from "openai/helpers/zod";

import { requireApiUser } from "@/lib/auth/server";
import {
  getCompanyInputCopy,
  getCompanyInputMode,
} from "@/lib/company-input-mode";
import { createOpenAIClient } from "@/lib/openai/client";
import { getServerEnv } from "@/lib/openai/env";
import {
  buildCompanyResearchInput,
  COMPANY_RESEARCH_INSTRUCTIONS,
} from "@/lib/prompts/company-research";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import {
  companyResearchOutputSchema,
  researchCompanyRequestSchema,
  type CompanyResearchOutput,
  type CompanyProfile,
  type ResearchCompanyRequest,
} from "@/lib/schemas/interview";
import { estimateResearchCompanyTokens } from "@/lib/tokens/ai-estimates";
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
export const maxDuration = 300;

const companyInputMode = getCompanyInputMode();
const companyInputCopy = getCompanyInputCopy(companyInputMode);

type CompanyResearchResult = {
  output: CompanyResearchOutput | null;
  usage: UsageParts;
};

function extractUrls(text: string): string[] {
  return Array.from(
    new Set(text.match(/https?:\/\/[^\s<>"'、。)）]+/g) ?? []),
  );
}

function mockResearchCompany(request: ResearchCompanyRequest): CompanyProfile {
  const now = new Date().toISOString();
  const companyHint = request.companyName || "調査対象企業";
  const researchSources = extractUrls(request.companyWebsite);
  return {
    id: crypto.randomUUID(),
    label: `${companyHint} 調査メモ`,
    companyName: companyHint,
    business:
      companyInputMode === "url"
        ? "指定されたWebサイトと志望内容をもとに、事業内容・採用情報・職種要件を調査して整理します。"
        : "入力された社風・採用情報・特筆事項と志望内容をもとに、事業内容・採用情報・職種要件を整理します。",
    philosophy:
      "企業理念・価値観・採用メッセージから、面接で触れるべき考え方を抽出します。",
    targetRole: request.desiredCourse,
    jobDescription:
      "志望職種・コースに関係する仕事内容、求められる役割、選考で見られそうな観点を整理します。",
    requiredSkills:
      "課題設定力、技術を現場実装へ落とし込む力、関係者調整、継続運用を見据えた改善力。",
    interviewFocus:
      "SatoFCでの現場実装、未知種棄却を含む安全なAI設計、自治体調整、チームリード経験との接続。",
    attraction:
      "研究や技術を机上で終わらせず、現場の意思決定や社会課題解決につなげられる点。",
    reverseQuestions:
      "配属後に現場課題を把握するプロセス、技術検証から運用定着までの進め方、若手に期待する役割。",
    researchInput: [
      `自分スロット: ${request.selfInfo}`,
      `会社名: ${request.companyName}`,
      `${companyInputCopy.promptField}: ${request.companyWebsite}`,
      `志望コース: ${request.desiredCourse}`,
      `その他: ${request.additionalNotes}`,
    ].join("\n"),
    researchInstruction: request.desiredCourse,
    researchSummary:
      companyInputMode === "url"
        ? "モックモードの調査結果です。実APIではResponses APIのweb_searchで企業サイトや採用情報を確認し、ユーザーの自己情報に合わせて要約します。"
        : researchSources.length > 0
          ? "モックモードの調査結果です。実APIでは入力欄のURLや採用情報を確認し、ユーザーの自己情報に合わせて要約します。"
          : "モックモードの調査結果です。実APIでは入力された社風・採用情報・特筆事項を読み、ユーザーの自己情報に合わせて要約します。",
    researchSources,
    fitHypotheses: [
      "SatoFCでの現場課題ヒアリングから開発・運用改善までの経験を、応募先の課題解決業務に接続できる。",
      "未知種をUnknownとして棄却する設計思想を、安全性や信頼性が求められる業務に接続できる。",
    ],
    interviewAngles: [
      "技術を目的化せず、現場の判断に使える形へ変換した経験",
      "異なる関係者の懸念を整理し、合意形成して前に進めた経験",
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function toCompanyProfile(
  output: CompanyResearchOutput,
  body: ResearchCompanyRequest,
): CompanyProfile {
  const now = new Date().toISOString();
  const companyName = body.companyName || output.companyName;
  return {
    ...output,
    id: crypto.randomUUID(),
    label: companyName ? `${companyName} 調査メモ` : output.label,
    companyName,
    researchInput: [
      `自分スロット: ${body.selfInfo}`,
      `会社名: ${body.companyName}`,
      `${companyInputCopy.promptField}: ${body.companyWebsite}`,
      `志望コース: ${body.desiredCourse}`,
      `その他: ${body.additionalNotes}`,
    ].join("\n"),
    researchInstruction: body.desiredCourse,
    createdAt: now,
    updatedAt: now,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function countWebSearchCalls(response: unknown): number {
  const output = asRecord(response)?.output;
  if (!Array.isArray(output)) {
    return 0;
  }
  return output.reduce((count, item) => {
    return asRecord(item)?.type === "web_search_call" ? count + 1 : count;
  }, 0);
}

async function runStructuredCompanyResearch(
  client: ReturnType<typeof createOpenAIClient>,
  model: string,
  body: ResearchCompanyRequest,
  signal: AbortSignal,
  useWebSearch: boolean,
): Promise<CompanyResearchResult> {
  const response = await client.responses.parse(
    {
      model,
      instructions: COMPANY_RESEARCH_INSTRUCTIONS,
      input: buildCompanyResearchInput(body),
      ...(useWebSearch
        ? {
            tools: [
              {
                type: "web_search" as const,
                search_context_size: "high" as const,
              },
            ],
            tool_choice: "required" as const,
            include: ["web_search_call.action.sources" as const],
          }
        : {}),
      text: {
        format: zodTextFormat(companyResearchOutputSchema, "company_research"),
      },
      store: false,
    },
    { signal },
  );

  return {
    output: response.output_parsed,
    usage: {
      ...extractOpenAIUsage(response),
      webSearchCalls: useWebSearch
        ? Math.max(countWebSearchCalls(response), 1)
        : 0,
    },
  };
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = researchCompanyRequestSchema.parse(await request.json());
    const env = getServerEnv();
    const model = env.RESEARCH_MODEL;
    const { requestId, operationId } = createRequestIds(request);
    const reservation = await reserveAiTokens({
      userId: auth.user.id,
      requestId,
      operationId,
      feature: "research-company",
      provider: env.AI_PROVIDER,
      model,
      estimatedAmount: estimateResearchCompanyTokens(body),
    });

    if (env.AI_MOCK_MODE) {
      await settleAiTokens(reservation, {
        inputTokens: 800,
        outputTokens: 1200,
        webSearchCalls: env.AI_PROVIDER === "openai" ? 1 : 0,
      });
      return Response.json(mockResearchCompany(body));
    }

    try {
      const client = createOpenAIClient();
      const result = await runStructuredCompanyResearch(
        client,
        model,
        body,
        request.signal,
        env.AI_PROVIDER === "openai",
      );

      if (!result.output) {
        await releaseAiTokenReservation(reservation, "parse_failed");
        return jsonError("企業調査結果の解析に失敗しました", 502);
      }

      await settleAiTokens(reservation, result.usage);
      return Response.json(toCompanyProfile(result.output, body));
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
