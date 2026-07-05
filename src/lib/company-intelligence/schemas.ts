import { z } from "zod";

export const companyIntelligenceResearchRequestSchema = z
  .object({
    companyName: z.string().trim().max(160).default(""),
    jobTitle: z.string().trim().max(160).default(""),
    urls: z.array(z.string().url()).max(8).default([]),
    interest: z.string().trim().max(80).default("成長重視"),
    selfInfo: z.string().trim().max(12000).default(""),
  })
  .refine(
    (value) => value.companyName.length > 0 || value.urls.length > 0,
    "企業名またはURLを入力してください。",
  );

export type CompanyIntelligenceResearchRequest = z.infer<
  typeof companyIntelligenceResearchRequestSchema
>;

const companyIntelligenceOutputUrlSchema = z.string().min(1);

export const companyIntelligenceSourceSchema = z.object({
  url: companyIntelligenceOutputUrlSchema,
  title: z.string().trim().default(""),
  sourceType: z
    .enum(["official", "recruiting", "ir", "news", "job-board", "other"])
    .default("other"),
  checkedAt: z.string().nullable(),
});

export type CompanyIntelligenceSource = z.infer<
  typeof companyIntelligenceSourceSchema
>;

export const supportedClaimSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  claim: z.string().min(1),
  sourceUrls: z.array(companyIntelligenceOutputUrlSchema).min(1),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

export type SupportedClaim = z.infer<typeof supportedClaimSchema>;

export const inferenceClaimSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  claim: z.string().min(1),
  basis: z.string().min(1),
  sourceUrls: z.array(companyIntelligenceOutputUrlSchema).default([]),
  confidence: z.enum(["medium", "low"]).default("low"),
});

export type InferenceClaim = z.infer<typeof inferenceClaimSchema>;

export const unknownItemSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  reason: z.string().min(1),
  suggestedCheck: z.string().min(1),
});

export type UnknownItem = z.infer<typeof unknownItemSchema>;

export const unverifiedClaimSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  reason: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low"]).default("medium"),
});

export type UnverifiedClaim = z.infer<typeof unverifiedClaimSchema>;

export const comparisonSignalSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  rationale: z.string().min(1),
  sourceUrls: z.array(companyIntelligenceOutputUrlSchema).default([]),
});

export const companyIntelligenceReportSchema = z.object({
  reportId: z
    .string()
    .min(1)
    .default(() => crypto.randomUUID()),
  companyName: z.string().min(1),
  jobTitle: z.string().default(""),
  statusSummary: z.string().min(1),
  checkedFacts: z.array(supportedClaimSchema).default([]),
  aiInferences: z.array(inferenceClaimSchema).default([]),
  unknowns: z.array(unknownItemSchema).default([]),
  unverifiedClaims: z.array(unverifiedClaimSchema).default([]),
  sources: z.array(companyIntelligenceSourceSchema).default([]),
  comparisonSignals: z.array(comparisonSignalSchema).default([]),
  researchLimitations: z.array(z.string().min(1)).default([]),
  generatedAt: z.string().default(() => new Date().toISOString()),
});

export type CompanyIntelligenceReport = z.infer<
  typeof companyIntelligenceReportSchema
>;

export const hallucinationAuditResultSchema = z.object({
  safeToDisplay: z.boolean(),
  unsupportedClaimsCount: z.number().int().min(0),
  highRiskClaimsCount: z.number().int().min(0),
  warnings: z.array(z.string()).default([]),
  blockedReasons: z.array(z.string()).default([]),
  checkedAt: z.string().datetime(),
});

export type HallucinationAuditResult = z.infer<
  typeof hallucinationAuditResultSchema
>;

export const companyIntelligenceStartResponseSchema = z.union([
  z.object({
    jobId: z.string().min(1),
    status: z.literal("completed"),
    report: companyIntelligenceReportSchema,
    audit: hallucinationAuditResultSchema,
  }),
  z.object({
    jobId: z.string().min(1),
    status: z.literal("running"),
  }),
]);

export type CompanyIntelligenceStartResponse = z.infer<
  typeof companyIntelligenceStartResponseSchema
>;
