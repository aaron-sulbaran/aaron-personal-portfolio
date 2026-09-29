import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pure-math and store tests under lib/; node environment, no jsdom. The "@"
// alias mirrors tsconfig paths so tests import modules the way the app does.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
