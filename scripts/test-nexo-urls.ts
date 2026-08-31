/**
 * A URL QUE NÃO PODE SER REVOGADA — o defeito dos seis tomos (31/08/2026).
 *
 * "6 arquivo(s) não estão disponíveis neste navegador e precisam ser gerados de
 * novo aqui: 088_25_met_tomo1.pdf …". Os bytes estavam no IndexedDB o tempo
 * todo; morta estava a URL, revogada pela SEGUNDA gravação do mesmo artefato —
 * que a regravava em seguida, já inválida.
 *
 * Núcleo PURO → node cru:
 *
 *   node scripts/test-nexo-urls.ts   (== npm run test:nexo:urls)
 */
import assert from "node:assert/strict";

import { urlsAAbandonar } from "../modules/nexo/lib/urls-a-abandonar.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${nome}`);
  } catch (err) {
    console.error(`FALHOU  ${nome}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const f = (url: string) => ({ url });

// -------------------------------------------------------------- o caso real

test("regravar o MESMO volume não revoga a URL que ele continua usando", () => {
  /*
   * `entregarVolume` chama `salvar` duas vezes com o mesmo `montado`: uma ao
   * montar, outra depois da conferência. As duas trazem a mesma URL.
   */
  const antes = [f("blob:vol-tomo1")];
  const depois = [f("blob:vol-tomo1")];
  assert.deepEqual(urlsAAbandonar(antes, depois), []);
});

test("os seis tomos sobrevivem à segunda gravação", () => {
  const urls = [1, 2, 3, 4, 5, 6].map((n) => f(`blob:vol-tomo${n}`));
  for (const u of urls) {
    assert.deepEqual(urlsAAbandonar([u], [u]), [], u.url);
  }
});

// ------------------------------------------------- e o vazamento continua barrado

test("regeração de verdade REVOGA a URL antiga — o vazamento segue barrado", () => {
  // Este é o motivo de a revogação existir: sem ela, cada regeração deixa os
  // bytes da anterior pendurados no navegador.
  const antes = [f("blob:velha")];
  const depois = [f("blob:nova")];
  assert.deepEqual(urlsAAbandonar(antes, depois), ["blob:velha"]);
});

test("arquivo que sumiu na regravação tem a URL revogada", () => {
  // O ODT saiu do conjunto: ninguém mais aponta para ele.
  const antes = [f("blob:pdf"), f("blob:odt")];
  const depois = [f("blob:pdf")];
  assert.deepEqual(urlsAAbandonar(antes, depois), ["blob:odt"]);
});

test("parte fica e parte sai, na mesma regravação", () => {
  const antes = [f("blob:pdf"), f("blob:odt-velho")];
  const depois = [f("blob:pdf"), f("blob:odt-novo")];
  assert.deepEqual(urlsAAbandonar(antes, depois), ["blob:odt-velho"]);
});

// -------------------------------------------------------------------- bordas

test("URL vazia não é revogada — revogar `` não faz nada e polui o diagnóstico", () => {
  assert.deepEqual(urlsAAbandonar([f("")], [f("blob:nova")]), []);
});

test("a mesma URL repetida em dois arquivos aparece UMA vez", () => {
  const antes = [f("blob:mesma"), f("blob:mesma")];
  assert.deepEqual(urlsAAbandonar(antes, []), ["blob:mesma"]);
});

test("conjunto anterior vazio não revoga nada", () => {
  assert.deepEqual(urlsAAbandonar([], [f("blob:nova")]), []);
});

console.log(`\n${passed} teste(s) ok`);
