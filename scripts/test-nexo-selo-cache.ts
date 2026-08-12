/**
 * Smoke-test das REGRAS do cache de leitura de selo — o que pode ser guardado e
 * o que volta de lá. Só as partes puras; o IndexedDB fica de fora.
 *
 * Estas duas decisões são as que, se erradas, ficam erradas para sempre: o
 * cache que guarda meia leitura congela o buraco, e o que devolve `usage` faz a
 * fatura cobrar duas vezes pela mesma página.
 *
 *   node scripts/test-nexo-selo-cache.ts   (== npm run test:nexo:selo-cache)
 */
import assert from "node:assert/strict";

import { leituraCompleta, reidratar } from "../modules/nexo/lib/selo-cache.ts";
import type { SeloResult } from "../modules/nexo/lib/selo-render.ts";

/*
 * O selo é construído aqui, e não importado de `selo-render`: aquele módulo
 * puxa `@/server/...`, um atalho que só o bundler resolve — importá-lo faria
 * este teste precisar do Next para rodar.
 */
const seloNaoLido = (): SeloResult["extraction"] => ({
  disciplina: null,
  arquivo: null,
  conteudo: null,
  obra: null,
  numeroDaFolha: null,
  totalDeFolhas: null,
  data: null,
  logoOrgao: null,
  confianca: "baixa",
});

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

const folha = (pageNumber: number, pageCount: number, extra: Partial<SeloResult> = {}): SeloResult => ({
  fileName: "EST-01.pdf",
  pageNumber,
  pageCount,
  extraction: seloNaoLido(),
  ...extra,
});

test("documento inteiro lido -> guarda", () => {
  assert.equal(leituraCompleta([folha(1, 2), folha(2, 2)]), true);
});

test("faltando uma página -> não guarda", () => {
  assert.equal(leituraCompleta([folha(1, 3), folha(2, 3)]), false);
});

test("uma página com erro -> não guarda o arquivo todo", () => {
  const comErro = folha(2, 2, { extraction: null, error: "timeout" });
  assert.equal(leituraCompleta([folha(1, 2), comErro]), false);
});

test("capa pulada conta como lida (não custou modelo)", () => {
  const capa = folha(1, 2, { extraction: null, ignorada: "capa" });
  assert.equal(leituraCompleta([capa, folha(2, 2)]), true);
});

test("folha sem extração e sem motivo -> não guarda", () => {
  const muda = folha(2, 2, { extraction: null });
  assert.equal(leituraCompleta([folha(1, 2), muda]), false);
});

test("lista vazia -> não guarda", () => {
  assert.equal(leituraCompleta([]), false);
});

test("volta com o nome de AGORA e sem os tokens já pagos", () => {
  const guardada = [folha(1, 1, { usage: 812 })];
  const [r] = reidratar(guardada, "EST-01 (revisado).pdf");
  assert.equal(r.fileName, "EST-01 (revisado).pdf");
  assert.equal(r.usage, undefined);
  assert.equal(r.pageNumber, 1);
  assert.notEqual(r.extraction, null);
});

test("reidratar não muta o que está guardado", () => {
  const guardada = [folha(1, 1, { usage: 812 })];
  reidratar(guardada, "outro.pdf");
  assert.equal(guardada[0].fileName, "EST-01.pdf");
  assert.equal(guardada[0].usage, 812);
});

console.log(`\n${passed} testes ok`);
