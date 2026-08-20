/**
 * O QUE IMPEDIA METADE DO `server/nexo` DE SER TESTADA EM NODE CRU.
 *
 * O código de produção importa sem extensão (`./disciplinas`) e pelo alias do
 * TypeScript (`@/server/...`). O bundler resolve os dois; `node script.ts`, não
 * — ele exige o caminho exato. O efeito prático estava registrado num comentário
 * de `scripts/test-nexo-blocos.ts`: "`parseFilename` de produção não pode ser
 * importado aqui". Testes que precisavam dele passaram a injetar dublês, e
 * `build-ld-proposal` — que decide o que sai impresso na LD — ficou sem teste
 * de node nenhum.
 *
 * Isto não muda o código de produção nem o build: é um resolvedor só para os
 * scripts, ligado por `--import`.
 *
 *   node --import ./scripts/lib/resolver-de-imports.mjs scripts/test-x.ts
 */
import { registerHooks } from "node:module";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = process.cwd();

/** A ordem importa: `.ts` antes de `.js` porque o fonte é a verdade aqui. */
const EXTENSOES = [".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"];

function primeiroQueExiste(base) {
  for (const ext of EXTENSOES) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let alvo = null;
    if (specifier.startsWith("@/")) {
      alvo = primeiroQueExiste(`${RAIZ}/${specifier.slice(2)}`);
    } else if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
      // Só mexe em quem NÃO tem extensão: um `./x.ts` explícito segue direto.
      alvo = primeiroQueExiste(fileURLToPath(new URL(specifier, context.parentURL)));
    }
    return alvo
      ? nextResolve(pathToFileURL(alvo).href, context)
      : nextResolve(specifier, context);
  },
});
