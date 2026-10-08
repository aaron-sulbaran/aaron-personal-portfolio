import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The gallery lab's own tests (the repo's config only runs lib/): pure
// layout, timing and stage arithmetic, node environment, the same "@" alias.
// From the repo root:
//   pnpm vitest run --config app/lab/gallery/tests/vitest.config.ts
export default defineConfig({
  root: fileURLToPath(new URL("../../../..", import.meta.url)),
  resolve: {
    alias: { "@": fileURLToPath(new URL("../../../..", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["app/lab/gallery/tests/**/*.test.ts"],
  },
});
