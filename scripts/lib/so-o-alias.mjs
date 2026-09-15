// Hook mínimo: resolve APENAS o alias "@/" do tsconfig. Não toca em mais nada
// (o resolvedor dos scripts também reescreve import relativo sem extensão, e
// isso quebra require de CJS dentro de node_modules — pg, resend).
import { registerHooks } from "node:module";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const RAIZ = process.cwd();
const EXT = [".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = `${RAIZ}/${specifier.slice(2)}`;
      for (const e of EXT) {
        if (fs.existsSync(base + e)) return { url: pathToFileURL(base + e).href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
