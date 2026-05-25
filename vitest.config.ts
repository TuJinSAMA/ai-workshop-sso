import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Unit tests must not touch the DB; integration tests will get their own
    // setup once we wire up a Postgres test container in M2.
    coverage: { provider: "v8", reporter: ["text", "html"] },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
