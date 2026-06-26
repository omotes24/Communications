"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { requirePublicSupabaseConfig } from "@/lib/supabase/config";
import type { SupabaseDatabase } from "@/lib/supabase/types";

export function createSupabaseBrowserClient() {
  const config = requirePublicSupabaseConfig();
  return createBrowserClient<SupabaseDatabase>(config.url, config.anonKey);
}

export function createSupabasePasswordRecoveryClient() {
  const config = requirePublicSupabaseConfig();
  return createClient<SupabaseDatabase>(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "implicit",
      persistSession: false,
    },
  });
}
