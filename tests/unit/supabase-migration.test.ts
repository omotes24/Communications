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
const pricingMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "202606240004_openai_pricing_rate_card.sql",
  ),
  "utf8",
);
const serviceRoleGrantsMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "202606250001_service_role_table_grants.sql",
  ),
  "utf8",
);
const researchWebSearchMultiplierMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "202606280001_research_web_search_multiplier.sql",
  ),
  "utf8",
);
const gpt54MiniAnswerRateMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "202606280002_gpt54_mini_answer_rate.sql",
  ),
  "utf8",
);
const questionSolverRateCardMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "202606280003_question_solver_rate_card.sql",
  ),
  "utf8",
);
const gpt56LunaAnswerRateMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "202607150001_gpt56_luna_answer_rate.sql",
  ),
  "utf8",
);
const allMigrations = `${migration}\n${hardeningMigration}\n${billingMigration}\n${pricingMigration}\n${serviceRoleGrantsMigration}\n${researchWebSearchMultiplierMigration}\n${gpt54MiniAnswerRateMigration}\n${questionSolverRateCardMigration}\n${gpt56LunaAnswerRateMigration}`;

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
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
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

  it("adds the OpenAI pricing rate card", () => {
    expect(pricingMigration).toContain("'default-v2'");
    expect(pricingMigration).toContain(
      "('default-v2', 'gpt-5.4-mini', 'generate-answer', 0.3333, 0.0833, 1.3333, 1.3333, 0, 0, true)",
    );
    expect(gpt54MiniAnswerRateMigration).toContain("'gpt-5.4-mini'");
    expect(gpt54MiniAnswerRateMigration).toContain("'generate-answer'");
    expect(gpt54MiniAnswerRateMigration).toContain("0.3333");
    expect(gpt54MiniAnswerRateMigration).toContain("1.3333");
    expect(gpt56LunaAnswerRateMigration).toContain("'gpt-5.6-luna'");
    expect(gpt56LunaAnswerRateMigration).toContain("'generate-answer'");
    expect(gpt56LunaAnswerRateMigration).toContain("'gpt56-luna-v1'");
    expect(gpt56LunaAnswerRateMigration).toContain("0.4444");
    expect(gpt56LunaAnswerRateMigration).toContain("0.1111");
    expect(gpt56LunaAnswerRateMigration).toContain("1.7777");
    expect(pricingMigration).toContain(
      "('default-v2', '*', 'research-company', 1, 0.25, 4, 4, 0, 550, true)",
    );
    expect(pricingMigration).toContain(
      "('default-v2', '*', 'transcribe-audio', 0, 0, 0, 0, 40, 0, true)",
    );
    expect(pricingMigration).toContain(
      "('default-v2', '*', 'solve-question', 1, 0.25, 6, 6, 0, 0, true)",
    );
    expect(questionSolverRateCardMigration).toContain("'solve-question'");
    expect(questionSolverRateCardMigration).toContain("1, 0.25, 6, 6");
    expect(pricingMigration).toContain("set active = false");
    expect(researchWebSearchMultiplierMigration).toContain(
      "web_search_multiplier = 550",
    );
    expect(researchWebSearchMultiplierMigration).toContain(
      "web_search_multiplier = 500",
    );
  });

  it("grants service role access to server-managed tables", () => {
    expect(serviceRoleGrantsMigration).toContain(
      "grant usage on schema public to service_role",
    );
    for (const table of [
      "profiles",
      "personal_slots",
      "company_slots",
      "interview_sessions",
      "interview_messages",
      "user_settings",
      "local_storage_imports",
      "token_wallets",
      "token_ledger",
      "token_reservations",
      "ai_usage_events",
      "token_rate_cards",
      "stripe_checkout_grants",
    ]) {
      expect(serviceRoleGrantsMigration).toContain(`public.${table}`);
    }
    expect(serviceRoleGrantsMigration).toContain("to service_role");
  });
});
