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

/**
 * DEPENDÊNCIA INSTALADA NÃO SE MEXE.
 *
 * O hook existe para o código DESTE repositório, que importa sem extensão. Um
 * pacote em `node_modules` já resolve sozinho, e pelas suas próprias regras —
 * `exports`, `main`, `require` de CommonJS.
 *
 * Sem esta guarda, o `require("./client")` interno do `pg` era capturado aqui e
 * devolvido ao carregador de CommonJS como URL `file://`, que ele não aceita:
 * "Cannot find module 'file:///.../pg/lib/client.js'". O efeito era qualquer
 * teste que tocasse o BANCO morrer na importação, com um erro que aponta para
 * dentro de uma dependência e não diz nada sobre a causa.
 */
function ehDependencia(caminho) {
  return caminho.includes("node_modules");
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL && ehDependencia(context.parentURL)) {
      return nextResolve(specifier, context);
    }

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
