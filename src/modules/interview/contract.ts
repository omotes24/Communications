import { z } from "zod";

import {
  createEmptyCompanyProfile,
  type CompanyProfile,
} from "@/lib/schemas/interview";

/**
 * JobTrack が Yell 面接モジュールを起動するときの唯一の境界。
 * 企業カタログ本体や非公開CSVを Yell 側へ複製しない。
 */
export const interviewLaunchContextSchema = z.object({
  host: z.enum(["standalone", "jobtrack"]),
  account: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("standalone") }),
    z.object({ mode: z.literal("shared") }),
    z.object({
      mode: z.literal("linked"),
      hostAccountRef: z.string().trim().min(8).max(160),
    }),
  ]),
  company: z
    .object({
      catalogRef: z.string().regex(/^JT\d{6}$/),
      name: z.string().trim().min(1).max(240),
      industry: z.string().trim().max(120).default(""),
      corporateUrl: z.string().url().optional(),
      recruitmentUrl: z.string().url().optional(),
    })
    .nullable(),
  targetRole: z.string().trim().max(160).default(""),
  selectionStage: z
    .enum(["screening", "first", "second", "final", "casual", "intern", "other"])
    .default("other"),
  entryPoint: z.enum(["company_detail", "schedule", "history", "direct"]),
});

export type InterviewLaunchContext = z.infer<
  typeof interviewLaunchContextSchema
>;

export function companyProfileFromLaunchContext(
  context: InterviewLaunchContext,
): CompanyProfile | null {
  if (!context.company) return null;
  const base = createEmptyCompanyProfile();
  return {
    ...base,
    label: context.company.name,
    companyName: context.company.name,
    business: context.company.industry,
    targetRole: context.targetRole,
    researchInput: [
      context.company.corporateUrl,
      context.company.recruitmentUrl,
    ]
      .filter(Boolean)
      .join("\n"),
    researchSources: [
      context.company.corporateUrl,
      context.company.recruitmentUrl,
    ].filter((value): value is string => Boolean(value)),
    sourceSystem: context.host,
    jobtrackCatalogRef: context.company.catalogRef,
  };
}
