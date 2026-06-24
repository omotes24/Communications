import "server-only";

import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const serverSupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalNonEmptyString,
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmptyString,
});

export type ServerSupabaseConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
};

export function getServerSupabaseConfig(): ServerSupabaseConfig | null {
  const parsed = serverSupabaseEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (
    !parsed.NEXT_PUBLIC_SUPABASE_URL ||
    !parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }

  return {
    url: parsed.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function requireServerSupabaseConfig(): ServerSupabaseConfig {
  const config = getServerSupabaseConfig();
  if (!config) {
    throw new Error("Supabaseのサーバー設定が不足しています。");
  }
  return config;
}

export function requireSupabaseServiceRoleKey(): string {
  const config = requireServerSupabaseConfig();
  if (!config.serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEYが設定されていません。");
  }
  return config.serviceRoleKey;
}
