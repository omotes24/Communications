import { z } from "zod";

const publicSupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1).optional(),
});

const serverSupabaseEnvSchema = publicSupabaseEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1).optional(),
});

export type PublicSupabaseConfig = {
  url: string;
  anonKey: string;
};

export type ServerSupabaseConfig = PublicSupabaseConfig & {
  serviceRoleKey?: string;
};

export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  const parsed = publicSupabaseEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
  };
}

export function requirePublicSupabaseConfig(): PublicSupabaseConfig {
  const config = getPublicSupabaseConfig();
  if (!config) {
    throw new Error(
      "Supabaseの公開URLまたはanon keyが設定されていません。",
    );
  }
  return config;
}

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
