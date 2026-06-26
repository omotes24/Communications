import {
  type CompanyIntelligenceReport,
  type CompanyIntelligenceResearchRequest,
  type HallucinationAuditResult,
} from "@/lib/company-intelligence/schemas";
import { inferCompanyNameFromUrl } from "@/lib/company-intelligence/url-validation";

const highRiskPatterns =
  /(給与|年収|勤務地|配属|選考|面接回数|内定|採用人数|福利厚生|リモート|転勤|残業|離職|有給|評価)/u;

export function auditCompanyIntelligenceReport(
  report: CompanyIntelligenceReport,
): HallucinationAuditResult {
  const warnings: string[] = [];
  const blockedReasons: string[] = [];
  let unsupportedClaimsCount = 0;
  let highRiskClaimsCount = 0;

  for (const claim of report.checkedFacts) {
    if (claim.sourceUrls.length === 0) {
      unsupportedClaimsCount += 1;
      blockedReasons.push(`根拠URLのない確認済み情報があります: ${claim.title}`);
    }
    if (highRiskPatterns.test(`${claim.title}\n${claim.claim}`)) {
      highRiskClaimsCount += 1;
      if (claim.confidence === "low") {
        warnings.push(`重要情報の信頼度が低い可能性があります: ${claim.title}`);
      }
    }
  }

  for (const item of report.aiInferences) {
    if (item.sourceUrls.length === 0) {
      warnings.push(`AI推定に根拠URLがありません: ${item.title}`);
    }
  }

  for (const item of report.unverifiedClaims) {
    if (item.severity === "critical" || item.severity === "high") {
      blockedReasons.push(`未確認の重要情報があります: ${item.claim}`);
    } else {
      warnings.push(`未確認情報があります: ${item.claim}`);
    }
  }

  if (report.checkedFacts.length === 0) {
    blockedReasons.push("確認済み情報がありません。");
  }

  if (report.sources.length === 0) {
    blockedReasons.push("情報源がありません。");
  }

  return {
    safeToDisplay: blockedReasons.length === 0,
    unsupportedClaimsCount,
    highRiskClaimsCount,
    warnings,
    blockedReasons,
    checkedAt: new Date().toISOString(),
  };
}

export function createMockCompanyIntelligenceReport(
  request: CompanyIntelligenceResearchRequest,
): CompanyIntelligenceReport {
  const now = new Date().toISOString();
  const primaryUrl = request.urls[0] ?? "https://example.com/recruit";
  const companyName =
    request.companyName || inferCompanyNameFromUrl(primaryUrl) || "調査対象企業";
  const jobTitle = request.jobTitle || "応募職種未指定";

  return {
    reportId: crypto.randomUUID(),
    companyName,
    jobTitle,
    statusSummary:
      "公開URLを根拠に、企業理解・応募職種との接続・面接で確認すべき点を整理しました。",
    checkedFacts: [
      {
        id: "fact-business",
        title: "確認できた情報",
        claim: `${companyName}の公開情報から、事業内容・採用メッセージ・応募職種に関係する要件を確認しました。`,
        sourceUrls: [primaryUrl],
        confidence: "medium",
      },
      {
        id: "fact-role",
        title: "応募職種との関係",
        claim: `${jobTitle}では、募集要項や採用ページに記載された業務内容と、ユーザーの経験を接続して話す必要があります。`,
        sourceUrls: [primaryUrl],
        confidence: "medium",
      },
    ],
    aiInferences: [
      {
        id: "fit-hypothesis",
        title: "AI推定",
        claim:
          "自分スロットの経験を、企業が公開している事業課題や職種要件に結びつけると、志望理由と自己PRの一貫性を作れます。",
        basis:
          "ユーザーの自己情報、応募職種、公開URLの内容を組み合わせた仮説です。",
        sourceUrls: [primaryUrl],
        confidence: "low",
      },
    ],
    unknowns: [
      {
        id: "unknown-selection",
        topic: "選考詳細",
        reason:
          "面接回数、評価基準、配属確約などは公開情報だけでは確定できない場合があります。",
        suggestedCheck:
          "説明会、採用担当者、募集要項の最新版で確認してください。",
      },
    ],
    unverifiedClaims: [],
    sources: request.urls.length
      ? request.urls.map((url) => ({
          url,
          title: inferCompanyNameFromUrl(url),
          sourceType: "other" as const,
          checkedAt: now,
        }))
      : [
          {
            url: primaryUrl,
            title: "example",
            sourceType: "other" as const,
            checkedAt: now,
          },
        ],
    comparisonSignals: [
      {
        label: "経験との接続",
        value: "要確認",
        rationale:
          "公開情報だけでは配属後の具体業務まで断定せず、面接で確認する前提にします。",
        sourceUrls: [primaryUrl],
      },
    ],
    researchLimitations: [
      "非公開の選考基準、配属、待遇、最新の募集停止状況は断定しません。",
      "AI推定は確認済み情報と分けて表示します。",
    ],
    generatedAt: now,
  };
}
