import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // Only measure coverage on files that have corresponding tests.
      // DB-dependent files (auth, rbac, leads, projects, upload, upsert-service)
      // are excluded until integration tests are added.
      include: [
        "src/services/csv/matcher.ts",
        "src/services/csv/stage-mapper.ts",
        "src/services/csv/parser-facebook.ts",
        "src/services/csv/parser-bitrix.ts",
        "src/services/csv/parser-cost.ts",
        "src/services/utils/unicode.ts",
        "src/middleware/rate-limit.ts",
        "src/routes/webhooks.ts",
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@dashboard/db/schema": path.resolve(__dirname, "../../packages/db/schema/index.ts"),
      "@dashboard/db": path.resolve(__dirname, "../../packages/db/index.ts"),
    },
  },
});
