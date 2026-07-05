import {
  inferCompanyNameFromUrl,
  validateCompanyResearchUrls,
} from "@/lib/company-intelligence/url-validation";

export const MAX_COMPANY_INTELLIGENCE_TARGETS = 10;

export type CompanyResearchTarget = {
  companyName: string;
  jobTitle: string;
  raw: string;
  urls: string[];
};

export type CompanyResearchTargetsParseResult = {
  targets: CompanyResearchTarget[];
  errors: string[];
  warnings: string[];
};

const urlPattern = /https?:\/\/[^\s、。，,;；)）\]】>＞]+/giu;
const rolePattern =
  /(総合職|営業職|技術職|研究職|企画職|事務職|開発職|エンジニア|データサイエンス|IT|DX|コンサル|マーケティング|リサーチ|アナリスト|デザイナー|.+職|.+コース)$/u;
const looseCommaPattern = /[、，,]+/u;

function cleanLooseText(value: string): string {
  return value
    .replace(urlPattern, " ")
    .replace(/^[\s・,、，;；:：|｜/／-]+/u, "")
    .replace(/[\s・,、，;；:：|｜/／-]+$/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function splitLooseInput(input: string): string[] {
  return input
    .replace(/\r/gu, "\n")
    .split(/\n+|[;；]+/u)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return [];
      }
      const withoutUrls = cleanLooseText(trimmed);
      const commaParts = withoutUrls
        .split(looseCommaPattern)
        .map((part) => part.trim())
        .filter(Boolean);

      if (
        commaParts.length > 1 &&
        commaParts.every((part) => !rolePattern.test(part))
      ) {
        return commaParts;
      }

      return [trimmed];
    })
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractUrls(input: string): string[] {
  return Array.from(input.matchAll(urlPattern), ([url]) => url);
}

function splitCompanyAndRole(input: string): {
  companyName: string;
  jobTitle: string;
} {
  const text = cleanLooseText(input);
  if (!text) {
    return { companyName: "", jobTitle: "" };
  }

  const fieldLabelMatch = text.match(
    /^(.+?)(?:の)?(?:応募職種|志望職種|志望コース|職種|コース)\s*[:：]\s*(.+)$/u,
  );
  if (fieldLabelMatch?.[1] && fieldLabelMatch[2]) {
    return {
      companyName: cleanLooseText(fieldLabelMatch[1]),
      jobTitle: cleanLooseText(fieldLabelMatch[2]),
    };
  }

  const bracketMatch = text.match(/^(.+?)[（(](.+?)[)）]$/u);
  if (
    bracketMatch?.[1] &&
    bracketMatch[2] &&
    rolePattern.test(bracketMatch[2])
  ) {
    return {
      companyName: cleanLooseText(bracketMatch[1]),
      jobTitle: cleanLooseText(bracketMatch[2]),
    };
  }

  const separatorMatch = text.match(
    /^(.+?)\s*(?:\/|／|\||｜| - | – | — )\s*(.+)$/u,
  );
  if (separatorMatch?.[1] && separatorMatch[2]) {
    return {
      companyName: cleanLooseText(separatorMatch[1]),
      jobTitle: cleanLooseText(separatorMatch[2]),
    };
  }

  const commaParts = text
    .split(looseCommaPattern)
    .map(cleanLooseText)
    .filter(Boolean);
  if (
    commaParts.length === 2 &&
    commaParts[0] &&
    commaParts[1] &&
    rolePattern.test(commaParts[1])
  ) {
    return {
      companyName: commaParts[0],
      jobTitle: commaParts[1],
    };
  }

  const suffixRoleMatch = text.match(/^(.+?)\s+(.+)$/u);
  if (
    suffixRoleMatch?.[1] &&
    suffixRoleMatch[2] &&
    rolePattern.test(suffixRoleMatch[2])
  ) {
    return {
      companyName: cleanLooseText(suffixRoleMatch[1]),
      jobTitle: cleanLooseText(suffixRoleMatch[2]),
    };
  }

  return { companyName: text, jobTitle: "" };
}

export function parseCompanyResearchTargets(
  input: string,
  maxTargets = MAX_COMPANY_INTELLIGENCE_TARGETS,
): CompanyResearchTargetsParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const targets: CompanyResearchTarget[] = [];
  const seen = new Set<string>();

  for (const chunk of splitLooseInput(input)) {
    const candidateUrls = extractUrls(chunk);
    const validation = validateCompanyResearchUrls(candidateUrls.join("\n"), 8);
    warnings.push(...validation.warnings);
    errors.push(...validation.errors);

    const { companyName: parsedCompanyName, jobTitle } =
      splitCompanyAndRole(chunk);
    const companyName =
      parsedCompanyName || inferCompanyNameFromUrl(validation.urls[0] ?? "");

    if (!companyName && validation.urls.length === 0) {
      continue;
    }

    const key = [
      companyName.toLowerCase(),
      jobTitle.toLowerCase(),
      validation.urls.join("|"),
    ].join("::");
    if (seen.has(key)) {
      warnings.push(`重複した調査対象を除外しました: ${companyName}`);
      continue;
    }
    seen.add(key);

    targets.push({
      companyName,
      jobTitle,
      urls: validation.urls,
      raw: chunk,
    });
  }

  if (targets.length > maxTargets) {
    warnings.push(
      `比較できる会社は最大${maxTargets}社です。超過分は除外しました。`,
    );
  }

  return {
    targets: targets.slice(0, maxTargets),
    errors,
    warnings,
  };
}
