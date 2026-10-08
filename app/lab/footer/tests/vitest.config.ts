import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The footer lab's own tests (the repo's config only runs lib/): pure math,
// node environment, the same "@" alias. From the repo root:
//   pnpm vitest run --config app/lab/footer/tests/vitest.config.ts
export default defineConfig({
  root: fileURLToPath(new URL("../../../..", import.meta.url)),
  resolve: {
    alias: { "@": fileURLToPath(new URL("../../../..", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["app/lab/footer/tests/**/*.test.ts"],
  },
});
