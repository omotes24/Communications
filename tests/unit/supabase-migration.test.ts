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
const hardeningMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "202606240002_staging_hardening.sql",
  ),
  "utf8",
);
const billingMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "202606240003_stripe_billing.sql",
  ),
  "utf8",
);
const allMigrations = `${migration}\n${hardeningMigration}\n${billingMigration}`;

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
      "release_expired_token_reservations",
      "grant_tokens",
      "admin_adjust_tokens",
    ]) {
      expect(allMigrations).toContain(`function public.${fn}`);
    }
  });

  it("keeps token mutation RPCs away from browser roles", () => {
    expect(hardeningMigration).toContain(
      "revoke execute on function public.reserve_tokens",
    );
    expect(hardeningMigration).toContain(
      "revoke execute on function public.grant_tokens",
    );
    expect(hardeningMigration).toContain(
      "grant execute on function public.reserve_tokens",
    );
    expect(hardeningMigration).toContain(
      "duplicate_request_id_for_different_user",
    );
    expect(hardeningMigration).toContain("for update skip locked");
  });

  it("keeps Stripe purchase grants idempotent and service-only", () => {
    expect(billingMigration).toContain("public.stripe_checkout_grants");
    expect(billingMigration).toContain(
      "stripe_checkout_session_id text primary key",
    );
    expect(billingMigration).toContain(
      "create or replace function public.grant_purchased_tokens",
    );
    expect(billingMigration).toContain(
      "on conflict (stripe_checkout_session_id) do nothing",
    );
    expect(billingMigration).toContain(
      "revoke execute on function public.grant_purchased_tokens",
    );
    expect(billingMigration).toContain(
      "grant execute on function public.grant_purchased_tokens",
    );
  });
});
