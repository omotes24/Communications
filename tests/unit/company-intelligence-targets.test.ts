import { describe, expect, it } from "vitest";

import {
  MAX_COMPANY_INTELLIGENCE_TARGETS,
  parseCompanyResearchTargets,
} from "@/lib/company-intelligence/targets";

describe("company intelligence target parsing", () => {
  it("parses company, role, and URL from one field", () => {
    const result = parseCompanyResearchTargets(
      [
        "三菱UFJ信託銀行 / 総合職 https://www.tr.mufg.jp/recruit/",
        "みずほ銀行 / システム・デジタルコース",
      ].join("\n"),
    );

    expect(result.errors).toEqual([]);
    expect(result.targets).toHaveLength(2);
    expect(result.targets[0]).toMatchObject({
      companyName: "三菱UFJ信託銀行",
      jobTitle: "総合職",
      urls: ["https://www.tr.mufg.jp/recruit/"],
    });
    expect(result.targets[1]).toMatchObject({
      companyName: "みずほ銀行",
      jobTitle: "システム・デジタルコース",
      urls: [],
    });
  });

  it("splits loose comma-separated company names", () => {
    const result = parseCompanyResearchTargets(
      "三菱UFJ銀行、三井住友銀行, みずほ銀行",
    );

    expect(result.targets.map((target) => target.companyName)).toEqual([
      "三菱UFJ銀行",
      "三井住友銀行",
      "みずほ銀行",
    ]);
  });

  it("keeps a comma-separated role with its company", () => {
    const result = parseCompanyResearchTargets(
      "三菱UFJ銀行、総合職\n三井住友銀行, システム・デジタルコース",
    );

    expect(result.targets).toHaveLength(2);
    expect(result.targets[0]).toMatchObject({
      companyName: "三菱UFJ銀行",
      jobTitle: "総合職",
    });
    expect(result.targets[1]).toMatchObject({
      companyName: "三井住友銀行",
      jobTitle: "システム・デジタルコース",
    });
  });

  it("caps comparison targets at ten companies", () => {
    const input = Array.from(
      { length: 12 },
      (_, index) => `テスト銀行${index + 1} / 総合職`,
    ).join("\n");
    const result = parseCompanyResearchTargets(input);

    expect(result.targets).toHaveLength(MAX_COMPANY_INTELLIGENCE_TARGETS);
    expect(
      result.warnings.some((warning) => warning.includes("最大10社")),
    ).toBe(true);
  });
});
