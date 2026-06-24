import { createClient } from "@supabase/supabase-js";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const url =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const limit = Number(args.get("--limit") || 100);

if (!url || !serviceRoleKey) {
  console.error(
    "Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run tokens:release-expired -- --limit 100",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.rpc(
  "release_expired_token_reservations",
  {
    p_limit: Math.max(1, Math.min(Math.floor(limit), 1000)),
  },
);

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(JSON.stringify({ released: data?.length ?? 0, reservations: data }, null, 2));
