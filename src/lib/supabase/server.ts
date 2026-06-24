import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import {
  requireServerSupabaseConfig,
  requireSupabaseServiceRoleKey,
} from "@/lib/supabase/config";
import type { SupabaseDatabase } from "@/lib/supabase/types";

export async function createSupabaseServerClient() {
  const config = requireServerSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient<SupabaseDatabase>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always mutate cookies. Middleware and
          // route handlers refresh sessions when mutation is available.
        }
      },
    },
  });
}

export function createSupabaseServiceClient() {
  const config = requireServerSupabaseConfig();
  return createClient<SupabaseDatabase>(
    config.url,
    requireSupabaseServiceRoleKey(),
    {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    },
  );
}
