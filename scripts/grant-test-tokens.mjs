import { createClient } from "@supabase/supabase-js";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const url =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const userId = args.get("--user");
const amount = Number(args.get("--amount"));
const requestId =
  args.get("--request-id") || `manual-test-grant:${userId}:${Date.now()}`;

if (!url || !serviceRoleKey || !userId || !Number.isFinite(amount) || amount <= 0) {
  console.error(
    "Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run tokens:grant-test -- --user <uuid> --amount <tokens>",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.rpc("grant_tokens", {
  p_user_id: userId,
  p_amount: Math.floor(amount),
  p_request_id: requestId,
  p_feature: "staging-test-grant",
  p_metadata: { source: "scripts/grant-test-tokens.mjs" },
});

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));
