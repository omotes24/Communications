import { zodTextFormat } from "openai/helpers/zod";

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

export const dynamic = "force-dynamic";

function mockResearchCompany(request: ResearchCompanyRequest): CompanyProfile {
  const now = new Date().toISOString();
  const companyHint =
    request.companyName ||
    (request.companyWebsite.match(/https?:\/\/(?:www\.)?([^/\s]+)/)?.[1] ??
      "調査対象企業");
  return {
    id: crypto.randomUUID(),
    label: `${companyHint} 調査メモ`,
    companyName: companyHint,
    business:
      "指定されたWebサイトと志望内容をもとに、事業内容・採用情報・職種要件を調査して整理します。",
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
      `自分のこと: ${request.selfInfo}`,
      `会社名: ${request.companyName}`,
      `企業Webサイト: ${request.companyWebsite}`,
      `志望コース: ${request.desiredCourse}`,
      `その他: ${request.additionalNotes}`,
    ].join("\n"),
    researchInstruction: request.desiredCourse,
    researchSummary:
      "モックモードの調査結果です。実APIではResponses APIのweb_searchで企業サイトや採用情報を確認し、ユーザーの自己情報に合わせて要約します。",
    researchSources: [request.companyWebsite],
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
      `自分のこと: ${body.selfInfo}`,
      `会社名: ${body.companyName}`,
      `企業Webサイト: ${body.companyWebsite}`,
      `志望コース: ${body.desiredCourse}`,
      `その他: ${body.additionalNotes}`,
    ].join("\n"),
    researchInstruction: body.desiredCourse,
    createdAt: now,
    updatedAt: now,
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = researchCompanyRequestSchema.parse(await request.json());
    const env = getServerEnv();

    if (env.AI_MOCK_MODE) {
      return Response.json(mockResearchCompany(body));
    }

    const client = createOpenAIClient();
    const response = await client.responses.parse(
      {
        model: env.RESEARCH_MODEL,
        instructions: COMPANY_RESEARCH_INSTRUCTIONS,
        input: buildCompanyResearchInput(body),
        ...(env.AI_PROVIDER === "openai"
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
          format: zodTextFormat(
            companyResearchOutputSchema,
            "company_research",
          ),
        },
        store: false,
      },
      { signal: request.signal },
    );

    if (!response.output_parsed) {
      return jsonError("企業調査結果の解析に失敗しました", 502);
    }

    return Response.json(toCompanyProfile(response.output_parsed, body));
  } catch (error) {
    return jsonError(toPublicError(error), 400);
  }
}
