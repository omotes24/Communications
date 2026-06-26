import { describe, expect, it } from "vitest";

import {
  auditCompanyIntelligenceReport,
  createMockCompanyIntelligenceReport,
} from "@/lib/company-intelligence/audit";
import type { CompanyIntelligenceReport } from "@/lib/company-intelligence/schemas";

function baseReport(): CompanyIntelligenceReport {
  return createMockCompanyIntelligenceReport({
    companyName: "Example",
    jobTitle: "総合職",
    urls: ["https://example.com/recruit"],
    interest: "成長重視",
    selfInfo: "研究と開発経験",
  });
}

describe("company intelligence hallucination audit", () => {
  it("allows a report when checked facts have sources", () => {
    const report = baseReport();
    const audit = auditCompanyIntelligenceReport(report);

    expect(audit.safeToDisplay).toBe(true);
    expect(audit.unsupportedClaimsCount).toBe(0);
  });

  it("blocks checked facts without source URLs", () => {
    const report = baseReport();
    report.checkedFacts[0] = {
      ...report.checkedFacts[0],
      sourceUrls: [],
    };
    const audit = auditCompanyIntelligenceReport(report);

    expect(audit.safeToDisplay).toBe(false);
    expect(audit.unsupportedClaimsCount).toBe(1);
    expect(audit.blockedReasons[0]).toContain("根拠URL");
  });

  it("blocks high severity unverified claims", () => {
    const report = baseReport();
    report.unverifiedClaims.push({
      id: "bad-location",
      claim: "勤務地は東京で確定です。",
      reason: "根拠URLがないため断定できません。",
      severity: "high",
    });
    const audit = auditCompanyIntelligenceReport(report);

    expect(audit.safeToDisplay).toBe(false);
    expect(audit.blockedReasons[0]).toContain("未確認");
  });
});
