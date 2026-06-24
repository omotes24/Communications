import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const publicSupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalNonEmptyString,
});

export type PublicSupabaseConfig = {
  url: string;
  anonKey: string;
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
