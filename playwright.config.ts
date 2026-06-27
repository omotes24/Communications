import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "AI_MOCK_MODE=true E2E_TEST_AUTH=true TEST_AUTH_USER_ID=00000000-0000-4000-8000-0000000000e2 TOKEN_TEST_MODE=true NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= SUPABASE_SERVICE_ROLE_KEY= npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
