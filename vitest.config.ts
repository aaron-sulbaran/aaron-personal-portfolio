import { defineConfig } from "vitest/config";

// Pure-math tests only (lib/carouselGeometry); node environment, no jsdom.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
