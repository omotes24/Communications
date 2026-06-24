import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/{unit,integration}/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "server-only": new URL(
        "./tests/fixtures/server-only-empty.ts",
        import.meta.url,
      ).pathname,
    },
  },
});
