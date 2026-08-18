/**
 * A COBERTURA CONTRA OS DOIS PARECERES REAIS DE 18/08/2026.
 *
 * Prova com dado de produção, não fixture: a corrida cuja leitura global morreu
 * em 503 e a corrida que leu as 218 páginas saíam com a MESMA cobertura e a
 * MESMA frase. Aqui elas passam a se distinguir.
 *
 *   node scripts/prova-cobertura-honesta.mjs <parecer-falho.json> <parecer-ok.json>
 */
import fs from "node:fs";
import {
  coberturaCompleta,
  coberturaReconciliada,
  resumoDoEsforco,
} from "../lib/resumo-do-esforco.ts";

const [falho, ok] = process.argv.slice(2);
if (!falho || !ok) {
  console.error("Uso: node scripts/prova-cobertura-honesta.mjs <falho.json> <ok.json>");
  process.exit(1);
}

let erros = 0;
for (const [nome, p] of [["FALHOU (503)", falho], ["OK", ok]]) {
  const r = JSON.parse(fs.readFileSync(p, "utf8")).report;
  const antes = r.arquivos_analisados[0];
  // O plano do Profundo é ZERO blocos — o campo não existia quando estes
  // pareceres foram gravados; aqui ele é reposto para medir o novo critério.
  const c = { ...antes.cobertura, blocos_planejados: 0 };
  const real = coberturaReconciliada(c, r.runtime.passadas_incompletas ?? []);
  const completa = coberturaCompleta(real);
  console.log(`### ${nome}`);
  console.log(`  ANTES : ${antes.resumo}`);
  console.log(`  DEPOIS: ${resumoDoEsforco(real)}`);
  console.log(`  caracteres_lidos: ${c.caracteres_lidos} -> ${real.caracteres_lidos}`);
  console.log(`  cobertura completa: ${completa}`);

  const esperado = nome === "OK";
  if (completa !== esperado) {
    console.error(`  FALHOU: esperava completa=${esperado}`);
    erros++;
  }
  console.log();
}

if (erros) {
  console.error(`${erros} caso(s) fora do esperado`);
  process.exit(1);
}
console.log("As duas corridas passam a se distinguir. OK");
