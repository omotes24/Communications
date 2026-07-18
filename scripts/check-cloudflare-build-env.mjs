import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const silentLogger = {
  info() {},
  error() {},
};

loadEnvConfig(process.cwd(), false, silentLogger);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required for a Cloudflare build.",
  );
}

let parsedUrl;
try {
  parsedUrl = new URL(supabaseUrl);
} catch {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL.");
}

if (parsedUrl.protocol !== "https:") {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL.");
}

if (supabaseAnonKey.length < 20) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is invalid.");
}

console.log("Cloudflare public build variables verified (values hidden).");
