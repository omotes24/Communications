import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "202606240001_multi_user_tokens.sql",
  ),
  "utf8",
);

describe("Supabase migration", () => {
  it("enables RLS for user data tables and defines token functions", () => {
    for (const table of [
      "profiles",
      "personal_slots",
      "company_slots",
      "interview_sessions",
      "interview_messages",
      "user_settings",
      "token_wallets",
      "token_ledger",
      "token_reservations",
      "ai_usage_events",
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }

    for (const fn of [
      "reserve_tokens",
      "settle_tokens",
      "release_token_reservation",
      "grant_tokens",
      "admin_adjust_tokens",
    ]) {
      expect(migration).toContain(`function public.${fn}`);
    }
  });
});
