import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-plugin-react-hooks 7 promotes two React Compiler checks to errors.
    // They flag render-time ref syncs and setState in mount effects that behave
    // correctly without the compiler. The ring's share retired with it; five
    // remain in surviving files (lib/modal.ts, Portal, Reveal, sections/Block),
    // so both stay warnings until those are fixed.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    // Flat config lints dot directories; these hold agent tooling and gitignored research, not site code.
    ".claude/**",
    ".cursor/**",
    ".impeccable/**",
    ".gstack/**",
    ".vercel/**",
    "docs/**",
    // Playwright's run output (traces, screenshots, the HTML report).
    "test-results/**",
    "playwright-report/**",
    "blob-report/**",
  ]),
]);

export default eslintConfig;
