import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-plugin-react-hooks 7 promotes two React Compiler checks to errors.
    // They flag existing ring, modal and reveal patterns (render-time ref sync,
    // setState in mount effects) that behave correctly without the compiler,
    // so they stay visible as warnings until the Coil rebuild retires that code.
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
  ]),
]);

export default eslintConfig;
