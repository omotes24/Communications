import { describe, expect, it } from "vitest";

import {
  describeCompanyResearchUrl,
  inferCompanyNameFromUrl,
  validateCompanyResearchUrls,
} from "@/lib/company-intelligence/url-validation";

describe("company intelligence URL validation", () => {
  it("accepts public http and https URLs", () => {
    const result = validateCompanyResearchUrls(
      "https://example.com/recruit\nhttp://jobs.example.co.jp/entry",
    );

    expect(result.errors).toEqual([]);
    expect(result.urls).toHaveLength(2);
    expect(result.urls[0]).toBe("https://example.com/recruit");
  });

  it("rejects unsafe URL schemes and private hosts", () => {
    const result = validateCompanyResearchUrls(
      [
        "file:///etc/passwd",
        "ftp://example.com",
        "http://localhost:3000",
        "http://127.0.0.1:54321",
        "http://10.0.0.1",
        "http://192.168.0.1",
        "http://169.254.169.254/latest/meta-data",
      ].join("\n"),
    );

    expect(result.urls).toEqual([]);
    expect(result.errors).toHaveLength(7);
  });

  it("deduplicates URLs and caps the number of inputs", () => {
    const input = Array.from(
      { length: 10 },
      (_, index) => `https://example${index}.com/recruit`,
    ).join("\n");
    const result = validateCompanyResearchUrls(
      `https://example.com/recruit\nhttps://example.com/recruit\n${input}`,
      8,
    );

    expect(result.urls).toHaveLength(8);
    expect(result.warnings.some((warning) => warning.includes("重複URL"))).toBe(
      true,
    );
    expect(result.warnings.some((warning) => warning.includes("最大8件"))).toBe(
      true,
    );
  });

  it("infers display hints from URLs", () => {
    expect(inferCompanyNameFromUrl("https://www.example.co.jp/careers")).toBe(
      "example",
    );
    expect(describeCompanyResearchUrl("https://example.com/careers")).toBe(
      "採用・求人",
    );
    expect(describeCompanyResearchUrl("https://example.com/ir")).toBe("IR");
  });
});
