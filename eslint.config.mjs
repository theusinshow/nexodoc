import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    ".next-bateria/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "design-system/**",
  ]),
]);

export default eslintConfig;
