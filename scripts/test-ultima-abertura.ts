/**
 * A ÚLTIMA ABERTURA VENCE — revisão final da segunda rodada, 15/09/2026.
 *
 * `selectConversation` espera a lista do servidor (até 4s), o disco e a rede
 * antes de trocar. Duas aberturas soltas pela MESMA espera (o F5 restaurando a
 * última conversa e um clique na barra, ou a retomada da auditoria em voo)
 * terminavam em qualquer ordem, e valia a que terminasse por último — o F5
 * podia desfazer o clique. Agora cada abertura pega uma vez na fila ao começar,
 * e só a mais recente troca de conversa.
 *
 *   node scripts/test-ultima-abertura.ts
 */
import assert from "node:assert/strict";

import { criarUltimaAbertura } from "../modules/nexo/lib/ultima-abertura.ts";

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

await test("uma abertura sozinha vale do começo ao fim", () => {
  const aberturas = criarUltimaAbertura();
  const a = aberturas.comecar();
  assert.equal(aberturas.valeAinda(a), true);
});

await test("a abertura que começou antes perde para a que começou depois, termine quando terminar", () => {
  const aberturas = criarUltimaAbertura();
  const f5 = aberturas.comecar();
  const clique = aberturas.comecar();
  // O clique termina primeiro e troca; o F5, que termina depois, não troca mais.
  assert.equal(aberturas.valeAinda(clique), true);
  assert.equal(aberturas.valeAinda(f5), false);
});

await test("duas aberturas soltas pela mesma espera: só a mais recente chega à troca", async () => {
  const aberturas = criarUltimaAbertura();
  let soltar!: () => void;
  const lista = new Promise<void>((r) => (soltar = r));
  const trocas: string[] = [];
  const abrir = async (id: string, trabalhoDepois: number) => {
    const minha = aberturas.comecar();
    await lista;
    await new Promise((r) => setTimeout(r, trabalhoDepois));
    if (!aberturas.valeAinda(minha)) return null;
    trocas.push(id);
    return id;
  };
  // A (F5) começa antes; B (clique) começa depois, mas o trabalho de A é mais longo.
  const a = abrir("A", 30);
  const b = abrir("B", 5);
  soltar();
  assert.deepEqual(await Promise.all([a, b]), [null, "B"]);
  assert.deepEqual(trocas, ["B"]);
});

await test("uma abertura nova depois de terminada a anterior vale normalmente", () => {
  const aberturas = criarUltimaAbertura();
  const a = aberturas.comecar();
  assert.equal(aberturas.valeAinda(a), true);
  const b = aberturas.comecar();
  assert.equal(aberturas.valeAinda(b), true);
});

console.log(`\n${passed} teste(s) passaram`);
