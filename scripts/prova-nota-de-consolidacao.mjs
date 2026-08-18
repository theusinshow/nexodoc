/**
 * O FILTRO CONTRA O PARECER REAL DE 18/08/2026.
 *
 * Fixture prova a regra; este script prova que ela acerta o alvo no parecer de
 * verdade — remove o INC-052 e NADA além dele, com os 57 restantes intactos.
 *
 *   node scripts/prova-nota-de-consolidacao.mjs <parecer.json>
 */
import fs from "node:fs";
import { semNotasDeConsolidacao } from "../lib/nota-de-consolidacao.ts";

const p = process.argv[2];
if (!p) {
  console.error("Uso: node scripts/prova-nota-de-consolidacao.mjs <parecer.json>");
  process.exit(1);
}

const r = JSON.parse(fs.readFileSync(p, "utf8")).report;
const { mantidos, removidos } = semNotasDeConsolidacao(r.incongruencias);

console.log(`achados no parecer : ${r.incongruencias.length}`);
console.log(`removidos          : ${removidos.length}`);
for (const f of removidos) {
  console.log(`  - ${f.id} [${f.tipo}] ${String(f.descricao).slice(0, 70)}`);
}
console.log(`mantidos           : ${mantidos.length}`);

const esperados = ["INC-052"];
const ids = removidos.map((f) => f.id).sort();
if (JSON.stringify(ids) !== JSON.stringify(esperados)) {
  console.error(`FALHOU: esperava remover ${esperados.join(",")}, removeu ${ids.join(",") || "nada"}`);
  process.exit(1);
}

/* Os que falam de duplicacao NO DOCUMENTO precisam sobreviver. */
for (const id of ["INC-050", "INC-057"]) {
  if (!mantidos.some((f) => f.id === id)) {
    console.error(`FALHOU: ${id} fala do documento e nao podia ter saido`);
    process.exit(1);
  }
}

console.log("\nRemoveu so a escrituracao. Os duplicados do documento ficaram. OK");
