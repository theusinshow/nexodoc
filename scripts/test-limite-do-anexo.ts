/**
 * O TETO POR ARQUIVO, NUM LUGAR SÓ.
 *
 * 17/09/2026: o número estava em quatro lugares e em dois valores —
 * `25 * 1024 * 1024` nas rotas e `25_000_000` no armazenamento. Um arquivo entre
 * os dois passava na rota e era recusado na gravação.
 *
 *   node scripts/test-limite-do-anexo.ts   (== npm run test:limite-do-anexo)
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  emMegabytes,
  excedeOLimite,
  LIMITE_DO_ARQUIVO_BYTES,
  motivoDeArquivoGrande,
} from "../lib/limite-do-anexo.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

test("o teto é 40 MB (decisão de 17/09/2026)", () => {
  assert.equal(LIMITE_DO_ARQUIVO_BYTES, 41_943_040);
  assert.equal(emMegabytes(LIMITE_DO_ARQUIVO_BYTES), "40 MB");
});

test("REGRESSÃO 031_26: o memorial de Urubici (26,8 MB) passa", () => {
  assert.equal(excedeOLimite(26_787_014), false);
});

test("acima do teto é recusado, e a borda exata passa", () => {
  assert.equal(excedeOLimite(LIMITE_DO_ARQUIVO_BYTES), false);
  assert.equal(excedeOLimite(LIMITE_DO_ARQUIVO_BYTES + 1), true);
});

test("o motivo traz os DOIS números e o que fazer", () => {
  const motivo = motivoDeArquivoGrande("031_26_md_geral_a.pdf", 45_000_000);
  assert.match(motivo, /031_26_md_geral_a\.pdf/);
  assert.match(motivo, /42,92 MB|42,9 MB/);
  assert.match(motivo, /40 MB/);
  assert.match(motivo, /comprimindo as imagens/);
});

test("sem nome (quem recusa é a gravação, que só tem bytes) a frase continua inteira", () => {
  const motivo = motivoDeArquivoGrande("", 45_000_000);
  assert.match(motivo, /^O arquivo tem /);
  assert.match(motivo, /40 MB/);
});

test("megabytes: duas casas abaixo de 10, uma acima, sem zero à toa", () => {
  assert.equal(emMegabytes(5 * 1024 * 1024), "5 MB");
  assert.equal(emMegabytes(1_500_000), "1,43 MB");
  assert.equal(emMegabytes(26_787_014), "25,5 MB");
});

/** GUARDA: nenhum teto de arquivo escrito à mão fora do módulo. */
test("ninguém mais escreve o teto por conta própria", () => {
  const PROIBIDO = /2[05]\s*\*\s*1024\s*\*\s*1024|25_000_000|40\s*\*\s*1024\s*\*\s*1024/;
  const fora: string[] = [];
  const varrer = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) {
        if (nome !== "node_modules" && !nome.startsWith(".")) varrer(caminho);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(nome)) continue;
      const rel = caminho.replace(/\\/g, "/");
      if (rel === "lib/limite-do-anexo.ts") continue;
      readFileSync(caminho, "utf8")
        .split("\n")
        .forEach((linha, i) => {
          if (PROIBIDO.test(linha)) fora.push(`${rel}:${i + 1}`);
        });
    }
  };
  for (const raiz of ["app", "components", "modules", "lib", "server"]) varrer(raiz);
  assert.deepEqual(fora, [], `teto de arquivo fora do módulo:\n${fora.join("\n")}`);
});

console.log(`\n${passed} teste(s) de limite do anexo OK`);
