import { promises as fs } from "node:fs";
import path from "node:path";

import { requireApiUser } from "@/lib/auth/server";
import { jsonError, toPublicError } from "@/lib/privacy/logging";
import { userProfileSchema } from "@/lib/schemas/interview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const auth = await requireApiUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const seedPath = path.join(process.cwd(), ".local", "profile-seed.json");
    const raw = await fs.readFile(seedPath, "utf8").catch((error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return null;
      }
      throw error;
    });

    if (!raw) {
      return Response.json(
        { profile: null },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const profile = userProfileSchema.parse(JSON.parse(raw));
    return Response.json(
      { profile },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(toPublicError(error), 400);
  }
}
