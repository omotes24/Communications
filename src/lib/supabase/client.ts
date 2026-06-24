"use client";

import { createBrowserClient } from "@supabase/ssr";

import { requirePublicSupabaseConfig } from "@/lib/supabase/config";
import type { SupabaseDatabase } from "@/lib/supabase/types";

export function createSupabaseBrowserClient() {
  const config = requirePublicSupabaseConfig();
  return createBrowserClient<SupabaseDatabase>(config.url, config.anonKey);
}
