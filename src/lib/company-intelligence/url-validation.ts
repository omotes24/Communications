export type CompanyResearchUrlValidation = {
  urls: string[];
  errors: string[];
  warnings: string[];
};

const blockedHostnames = new Set([
  "localhost",
  "metadata.google.internal",
  "169.254.169.254",
  "0.0.0.0",
]);

function cleanCandidate(candidate: string): string {
  return candidate.trim().replace(/[、。，,.;；)）\]】>＞]+$/u, "");
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return false;
  }
  const octets = parts.map((part) => Number(part));
  if (
    octets.some(
      (octet, index) =>
        !Number.isInteger(octet) ||
        octet < 0 ||
        octet > 255 ||
        String(octet) !== parts[index],
    )
  ) {
    return false;
  }
  const [a, b] = octets;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[(.*)\]$/u, "$1");
  if (blockedHostnames.has(normalized)) {
    return true;
  }
  if (normalized.endsWith(".localhost") || normalized.endsWith(".local")) {
    return true;
  }
  if (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  ) {
    return true;
  }
  return isPrivateIpv4(normalized);
}

function toUrl(candidate: string): URL | null {
  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

export function extractCompanyResearchUrlCandidates(input: string): string[] {
  return input
    .split(/[\s\n\r\t]+/u)
    .map(cleanCandidate)
    .filter(Boolean);
}

export function validateCompanyResearchUrls(
  input: string,
  maxUrls = 8,
): CompanyResearchUrlValidation {
  const urls: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const candidate of extractCompanyResearchUrlCandidates(input)) {
    const parsed = toUrl(candidate);
    if (!parsed) {
      errors.push(`URL形式ではありません: ${candidate}`);
      continue;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      errors.push(`http/https以外のURLは使えません: ${candidate}`);
      continue;
    }
    if (isBlockedHostname(parsed.hostname)) {
      errors.push(`安全のため、このURLは利用できません: ${candidate}`);
      continue;
    }
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") {
      errors.push(`公開URLとして確認できません: ${candidate}`);
      continue;
    }

    parsed.hash = "";
    const normalized = parsed.toString();
    if (seen.has(normalized)) {
      warnings.push(`重複URLを除外しました: ${candidate}`);
      continue;
    }
    seen.add(normalized);
    urls.push(normalized);
  }

  if (urls.length > maxUrls) {
    warnings.push(`URLは最大${maxUrls}件までです。超過分は除外しました。`);
    return { urls: urls.slice(0, maxUrls), errors, warnings };
  }

  return { urls, errors, warnings };
}

export function inferCompanyNameFromUrl(url: string): string {
  const parsed = toUrl(url);
  if (!parsed) {
    return "";
  }
  const parts = parsed.hostname
    .replace(/^www\./u, "")
    .split(".")
    .filter(Boolean);
  return parts[0] ?? "";
}

export function describeCompanyResearchUrl(url: string): string {
  const parsed = toUrl(url);
  if (!parsed) {
    return "URL";
  }
  const haystack = `${parsed.hostname} ${parsed.pathname}`.toLowerCase();
  if (/recruit|career|job|採用/u.test(haystack)) {
    return "採用・求人";
  }
  if (/ir|investor|finance|annual/u.test(haystack)) {
    return "IR";
  }
  if (/news|press|release/u.test(haystack)) {
    return "ニュース";
  }
  if (/wantedly|mynavi|rikunabi|openwork/u.test(haystack)) {
    return "求人・口コミ系";
  }
  return "公式・一般";
}
