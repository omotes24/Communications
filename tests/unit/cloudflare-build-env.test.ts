import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const script = path.join(
  process.cwd(),
  "scripts",
  "check-cloudflare-build-env.mjs",
);
const productionTargetScript = path.join(
  process.cwd(),
  "scripts",
  "check-cloudflare-production-target.mjs",
);
const temporaryDirectories: string[] = [];

function createEmptyProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yfy-cf-env-"));
  temporaryDirectories.push(root);
  return root;
}

function runCheck(root: string, env: Record<string, string | undefined> = {}) {
  return spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      ...env,
      NODE_ENV: "production" as const,
    },
  });
}

function runProductionTargetCheck(root: string, url: string, anonKey: string) {
  return spawnSync(process.execPath, [productionTargetScript], {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    },
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("Cloudflare build environment check", () => {
  it("accepts explicit non-empty public variables without printing them", () => {
    const root = createEmptyProject();
    const sentinelUrl = "https://build-sentinel.invalid";
    const sentinelKey = "build-sentinel-anon-key-not-a-secret";
    const result = runCheck(root, {
      NEXT_PUBLIC_SUPABASE_URL: sentinelUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: sentinelKey,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("values hidden");
    expect(`${result.stdout}${result.stderr}`).not.toContain(sentinelUrl);
    expect(`${result.stdout}${result.stderr}`).not.toContain(sentinelKey);
  });

  it("fails before build when either public variable is empty", () => {
    const root = createEmptyProject();
    const result = runCheck(root, {
      NEXT_PUBLIC_SUPABASE_URL: "https://build-sentinel.invalid",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(result.stderr).not.toContain("build-sentinel.invalid");
  });

  it("rejects a non-HTTPS URL without printing its value", () => {
    const root = createEmptyProject();
    const sentinelUrl = "http://private-build-sentinel.invalid";
    const result = runCheck(root, {
      NEXT_PUBLIC_SUPABASE_URL: sentinelUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "build-sentinel-anon-key-not-a-secret",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("valid HTTPS URL");
    expect(result.stderr).not.toContain(sentinelUrl);
  });

  it("rejects a different production Supabase host without printing it", () => {
    const root = createEmptyProject();
    const sentinelUrl = "https://different-target-sentinel.invalid";
    const rejected = runProductionTargetCheck(
      root,
      sentinelUrl,
      "different-target-anon-key-not-a-secret",
    );

    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain(
      "configuration does not match the production target",
    );
    expect(rejected.stderr).not.toContain(sentinelUrl);
    expect(rejected.stderr).not.toContain("different-target-anon-key");
  });
});
