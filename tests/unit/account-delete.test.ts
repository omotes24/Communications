import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const routeSource = readFileSync(
  join(process.cwd(), "src", "app", "api", "account", "delete", "route.ts"),
  "utf8",
);

describe("account deletion route", () => {
  it("deletes storage objects before deleting the auth user", () => {
    expect(routeSource).toContain("deleteStorageObjectsForUser(auth.user.id)");
    expect(routeSource).toContain("auth.admin.deleteUser(auth.user.id)");
    expect(routeSource.indexOf("deleteStorageObjectsForUser(auth.user.id)")).toBeLessThan(
      routeSource.indexOf("auth.admin.deleteUser(auth.user.id)"),
    );
  });
});
