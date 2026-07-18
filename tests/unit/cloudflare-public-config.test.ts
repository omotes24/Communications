import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const script = path.join(
  process.cwd(),
  "scripts",
  "check-cloudflare-public-config.mjs",
);
const temporaryDirectories: string[] = [];

function createArtifact({
  serverUrl = "https://server-project.invalid",
  clientUrl = serverUrl,
  serverAnonKey = "server-anon-key-with-safe-test-length",
  clientAnonKey = serverAnonKey,
}: {
  serverUrl?: string;
  clientUrl?: string;
  serverAnonKey?: string;
  clientAnonKey?: string;
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yfy-cf-config-"));
  temporaryDirectories.push(root);
  const serverDirectory = path.join(
    root,
    ".open-next/server-functions/default/.next/server/app/api/admin/reconcile-token-reservations",
  );
  const clientDirectory = path.join(
    root,
    ".open-next/assets/_next/static/chunks",
  );
  fs.mkdirSync(serverDirectory, { recursive: true });
  fs.mkdirSync(clientDirectory, { recursive: true });

  const configSource = (url: string, anonKey: string) =>
    `const config={NEXT_PUBLIC_SUPABASE_URL:${JSON.stringify(url)},NEXT_PUBLIC_SUPABASE_ANON_KEY:${JSON.stringify(anonKey)}};`;
  fs.writeFileSync(
    path.join(serverDirectory, "route.js"),
    configSource(serverUrl, serverAnonKey),
  );
  fs.writeFileSync(
    path.join(clientDirectory, "client.js"),
    configSource(clientUrl, clientAnonKey),
  );
  return root;
}

function runCheck(root: string) {
  return spawnSync(process.execPath, [script, "--root", root], {
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("Cloudflare public build config check", () => {
  it("accepts matching non-empty server and client values without printing them", () => {
    const root = createArtifact();
    const result = runCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("values hidden");
    expect(result.stdout).not.toContain("server-project");
    expect(result.stdout).not.toContain("server-anon-key");
  });

  it("keeps every Cloudflare command behind the build gates", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["build:cloudflare"]).toMatch(
      /^node scripts\/check-cloudflare-build-env\.mjs && opennextjs-cloudflare build && node scripts\/check-cloudflare-public-config\.mjs$/,
    );
    expect(packageJson.scripts["build:cloudflare:production"]).toMatch(
      /^node scripts\/check-cloudflare-production-target\.mjs && npm run build:cloudflare$/,
    );
    for (const command of ["preview", "deploy:staging"]) {
      expect(packageJson.scripts[command]).toMatch(
        /^npm run build:cloudflare && /,
      );
    }
    for (const command of ["deploy:production", "upload:cloudflare"]) {
      expect(packageJson.scripts[command]).toMatch(
        /^npm run build:cloudflare:production && /,
      );
    }
  });

  it("fails when build variables were inlined as empty strings", () => {
    const root = createArtifact({ serverUrl: "", clientUrl: "" });
    const result = runCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("missing public Supabase build variable");
  });

  it("fails when server and client artifacts use different environments", () => {
    const root = createArtifact({
      clientUrl: "https://different-project.invalid",
    });
    const result = runCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("different public Supabase values");
    expect(result.stderr).not.toContain("server-project");
    expect(result.stderr).not.toContain("different-project");
    expect(result.stderr).not.toContain("server-anon-key");
  });
});
