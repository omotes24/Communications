import { createHash } from "node:crypto";

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const productionSupabaseConfigSha256 =
  "9b8c140b932e032e8e6af391cf8a16de9ef06eca91f436f8773f65f41405a7a4";
const silentLogger = {
  info() {},
  error() {},
};

loadEnvConfig(process.cwd(), false, silentLogger);

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
if (!rawUrl || !rawAnonKey) {
  throw new Error(
    "The public Supabase configuration is required for a production deploy.",
  );
}

let targetUrl;
try {
  targetUrl = new URL(rawUrl);
} catch {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is invalid.");
}

if (
  targetUrl.protocol !== "https:" ||
  targetUrl.username ||
  targetUrl.password ||
  targetUrl.pathname !== "/" ||
  targetUrl.search ||
  targetUrl.hash
) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid base URL.");
}

const actualFingerprint = createHash("sha256")
  .update(`${targetUrl.origin}\0${rawAnonKey}`)
  .digest("hex");
if (actualFingerprint !== productionSupabaseConfigSha256) {
  throw new Error(
    "Production deploy blocked because the Supabase configuration does not match the production target.",
  );
}

console.log("Cloudflare production target verified (values hidden).");
