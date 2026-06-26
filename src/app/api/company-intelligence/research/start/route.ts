import { zodTextFormat } from "openai/helpers/zod";

import {
  auditCompanyIntelligenceReport,
  createMockCompanyIntelligenceReport,
} from "@/lib/company-intelligence/audit";
import {
  buildDeepResearchPrompt,
  buildNormalizationPrompt,
} from "@/lib/company-intelligence/prompts";
import {
  companyIntelligenceReportSchema,
  companyIntelligenceResearchRequestSchema,
  type CompanyIntelligenceReport,
  type CompanyIntelligenceResearchRequest,
} from "@/lib/company-intelligence/schemas";
import { requireApiUser } from "@/lib/auth/server";
import { createOpenAIClient } from "@/lib/openai/client";
import { getServerEnv } from "@/lib/openai/env";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import {
  createRequestIds,
  releaseAiTokenReservation,
  reserveAiTokens,
  settleAiTokens,
  TokenBalanceError,
} from "@/lib/tokens/service";
import {
  extractOpenAIUsage,
  estimateTextTokens,
  type UsageParts,
} from "@/lib/tokens/usage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function estimateCompanyIntelligenceTokens(
  body: CompanyIntelligenceResearchRequest,
): number {
  return Math.max(
    6000,
    estimateTextTokens(
      [
        body.companyName,
        body.jobTitle,
        body.urls.join("\n"),
        body.interest,
        body.selfInfo,
      ].join("\n"),
    ) + 9000,
  );
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

function sumUsage(...parts: UsageParts[]): UsageParts {
  return parts.reduce<UsageParts>(
    (total, current) => ({
      inputTokens: (total.inputTokens ?? 0) + (current.inputTokens ?? 0),
      cachedInputTokens:
        (total.cachedInputTokens ?? 0) + (current.cachedInputTokens ?? 0),
      outputTokens: (total.outputTokens ?? 0) + (current.outputTokens ?? 0),
      reasoningTokens:
        (total.reasoningTokens ?? 0) + (current.reasoningTokens ?? 0),
      webSearchCalls:
        (total.webSearchCalls ?? 0) + (current.webSearchCalls ?? 0),
    }),
    {},
  );
}

function normalizeOutputText(response: unknown): string {
  const record = asRecord(response);
  if (typeof record?.output_text === "string") {
    return record.output_text;
  }
  const output = record?.output;
  if (!Array.isArray(output)) {
    return "";
  }
  return output
    .flatMap((item) => {
      const content = asRecord(item)?.content;
      if (!Array.isArray(content)) {
        return [];
      }
      return content
        .map((chunk) => asRecord(chunk)?.text)
        .filter((text): text is string => typeof text === "string");
    })
    .join("\n");
}

function extractAnnotationSources(response: unknown): Array<{
  url: string;
  title: string;
}> {
  const output = asRecord(response)?.output;
  if (!Array.isArray(output)) {
    return [];
  }
  const sources = new Map<string, string>();
  for (const item of output) {
    const content = asRecord(item)?.content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const chunk of content) {
      const annotations = asRecord(chunk)?.annotations;
      if (!Array.isArray(annotations)) {
        continue;
      }
      for (const annotation of annotations) {
        const record = asRecord(annotation);
        if (!record) {
          continue;
        }
        const url = record.url;
        if (typeof url === "string" && url.startsWith("http")) {
          sources.set(url, typeof record.title === "string" ? record.title : "");
        }
      }
    }
  }
  return Array.from(sources, ([url, title]) => ({ url, title }));
}

async function runDeepResearch(
  client: ReturnType<typeof createOpenAIClient>,
  model: string,
  body: CompanyIntelligenceResearchRequest,
  signal: AbortSignal,
): Promise<{ text: string; usage: UsageParts }> {
  const response = await client.responses.create(
    {
      model,
      input: buildDeepResearchPrompt(body),
      tools: [
        {
          type: "web_search_preview",
          search_context_size: "medium",
        },
      ],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      background: false,
      store: false,
    } as never,
    { signal },
  );

  const annotationSources = extractAnnotationSources(response);

  return {
    text: [
      normalizeOutputText(response),
      annotationSources.length
        ? [
            "抽出された情報源:",
            ...annotationSources.map((source) =>
              source.title ? `${source.title}: ${source.url}` : source.url,
            ),
          ].join("\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    usage: {
      ...extractOpenAIUsage(response),
      webSearchCalls: Math.max(countWebSearchCalls(response), 1),
    },
  };
}

async function normalizeStrictReport(
  client: ReturnType<typeof createOpenAIClient>,
  model: string,
  body: CompanyIntelligenceResearchRequest,
  rawResearch: string,
  signal: AbortSignal,
): Promise<{ report: CompanyIntelligenceReport | null; usage: UsageParts }> {
  const response = await client.responses.parse(
    {
      model,
      input: buildNormalizationPrompt(body, rawResearch),
      text: {
        format: zodTextFormat(
          companyIntelligenceReportSchema,
          "company_intelligence_report",
        ),
      },
      store: false,
    },
    { signal },
  );

  return {
    report: response.output_parsed,
    usage: extractOpenAIUsage(response),
  };
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = companyIntelligenceResearchRequestSchema.parse(
      await request.json(),
    );
    const env = getServerEnv();
    const model = env.COMPANY_INTELLIGENCE_DEEP_RESEARCH_MODEL;
    const { requestId, operationId } = createRequestIds(request);
    const reservation = await reserveAiTokens({
      userId: auth.user.id,
      requestId,
      operationId,
      feature: "research-company",
      provider: env.AI_PROVIDER,
      model,
      estimatedAmount: estimateCompanyIntelligenceTokens(body),
      metadata: {
        route: "company-intelligence",
        strictMode: env.COMPANY_INTELLIGENCE_STRICT_MODE,
      },
    });

    if (env.AI_MOCK_MODE || env.COMPANY_INTELLIGENCE_MOCK_MODE) {
      const report = createMockCompanyIntelligenceReport(body);
      const audit = auditCompanyIntelligenceReport(report);
      await settleAiTokens(reservation, {
        inputTokens: 1400,
        outputTokens: 2600,
        webSearchCalls: body.urls.length > 0 ? 1 : 0,
      });
      return Response.json({
        jobId: report.reportId,
        status: "completed",
        report,
        audit,
      });
    }

    try {
      const client = createOpenAIClient({ timeoutMs: 290_000 });
      const deepResearch = await runDeepResearch(
        client,
        model,
        body,
        request.signal,
      );
      const normalized = await normalizeStrictReport(
        client,
        env.COMPANY_INTELLIGENCE_SYNTHESIS_MODEL,
        body,
        deepResearch.text,
        request.signal,
      );

      if (!normalized.report) {
        await releaseAiTokenReservation(reservation, "parse_failed");
        return jsonError("企業研究レポートの正規化に失敗しました。", 502);
      }

      const audit = auditCompanyIntelligenceReport(normalized.report);
      if (!audit.safeToDisplay) {
        await settleAiTokens(
          reservation,
          sumUsage(deepResearch.usage, normalized.usage),
          "failed",
        );
        return Response.json(
          {
            error:
              "根拠が不足しているため、この企業研究結果は表示できません。",
            audit,
          },
          { status: 422 },
        );
      }

      await settleAiTokens(
        reservation,
        sumUsage(deepResearch.usage, normalized.usage),
      );
      return Response.json({
        jobId: normalized.report.reportId,
        status: "completed",
        report: normalized.report,
        audit,
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
