import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    ".next-bateria/**",
    ".next-ux/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "design-system/**",
    // design-sync: as prévias importam "nexo-ds", que só existe no pacote enviado ao Claude Design.
    ".design-sync/**",
    ".ds-sync/**",
    "ds-bundle/**",
    // Rascunho local (ignorado pelo git): o CI nunca o vê, e o lint local não deve contar.
    "scratchpad/**",
  ]),
]);

export default eslintConfig;
