import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

function filesBelow(path: string): string[] {
  const absolute = join(root, path);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(absolute, entry.name);
    if (entry.isDirectory()) {
      return filesBelow(relative(root, entryPath));
    }
    return [relative(root, entryPath)];
  });
}

describe("administrator route inventory", () => {
  it.each(
    filesBelow("src/app/admin").filter((path) => path.endsWith("page.tsx")),
  )("keeps the page-level owner guard on %s", (path) => {
    expect(source(path)).toContain("getAdminUser");
    expect(source(path)).toContain("AdminAccessDenied");
  });

  it.each([
    ...filesBelow("src/app/api/admin").filter(
      (path) =>
        path.endsWith("route.ts") &&
        !path.endsWith("reconcile-token-reservations/route.ts"),
    ),
    "src/app/api/interview-experiences/route.ts",
    "src/app/api/interview-experiences/draft/route.ts",
  ])("keeps the server-side owner guard on %s", (path) => {
    expect(source(path)).toContain("requireAdminApiUser");
  });

  it("keeps the Cloudflare cron on its separate bearer-secret boundary", () => {
    const cron = source(
      "src/app/api/admin/reconcile-token-reservations/route.ts",
    );
    expect(cron).toContain("hasValidCronAuthorization");
    expect(cron).toContain("process.env.CRON_SECRET");
    expect(cron).not.toContain("requireAdminApiUser");
  });

  it("does not implement an XYZ credential channel", () => {
    const applicationSource = [
      "src/lib/auth/admin.ts",
      "src/app/admin/page.tsx",
      "src/app/admin/analytics/page.tsx",
      "src/app/api/admin/stats/route.ts",
      "src/app/api/admin/analytics/route.ts",
      "src/app/api/admin/export/[dataset]/route.ts",
    ]
      .map(source)
      .join("\n");

    expect(applicationSource).not.toMatch(
      /XYZ_KEY|ADMIN_XYZ|x-xyz-key|xyzKey|searchParams\.get\(["']xyz/i,
    );
  });
});
