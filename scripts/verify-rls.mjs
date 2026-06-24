import { createClient } from "@supabase/supabase-js";

const url =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const credentials = [
  {
    label: "A",
    email: process.env.RLS_USER_A_EMAIL,
    password: process.env.RLS_USER_A_PASSWORD,
  },
  {
    label: "B",
    email: process.env.RLS_USER_B_EMAIL,
    password: process.env.RLS_USER_B_PASSWORD,
  },
];

if (!url || !anonKey || credentials.some((item) => !item.email || !item.password)) {
  console.error(
    "Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... RLS_USER_A_EMAIL=... RLS_USER_A_PASSWORD=... RLS_USER_B_EMAIL=... RLS_USER_B_PASSWORD=... npm run supabase:verify-rls",
  );
  process.exit(1);
}

async function signIn({ email, password }) {
  const client = createClient(url, anonKey);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
  return client;
}

const [clientA, clientB] = await Promise.all(credentials.map(signIn));
const slotId = crypto.randomUUID();

const { error: insertError } = await clientA.from("personal_slots").insert({
  id: slotId,
  user_id: (await clientA.auth.getUser()).data.user.id,
  name: "RLS verification slot",
  content: { label: "RLS verification" },
});

if (insertError) {
  throw insertError;
}

const { data: visibleToB, error: selectError } = await clientB
  .from("personal_slots")
  .select("id")
  .eq("id", slotId);

if (selectError) {
  throw selectError;
}

await clientA.from("personal_slots").delete().eq("id", slotId);

if ((visibleToB ?? []).length !== 0) {
  throw new Error("RLS failure: user B could read user A data");
}

console.log("RLS verification passed: user B cannot read user A personal_slots row.");
