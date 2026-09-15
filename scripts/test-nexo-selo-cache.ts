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
const extracaoLegivel = (): SeloResult["extraction"] => ({
  disciplina: null,
  arquivo: "990_26_est_001_a",
  conteudo: null,
  obra: null,
  numeroDaFolha: null,
  totalDeFolhas: null,
  data: null,
  logoOrgao: null,
  confianca: "baixa",
});

/**
 * O objeto TRUTHY, com todo campo vazio, que a versão do leitor de ANTES do
 * conserto de 15/09/2026 (v2) devolvia — e que o cache guardava como "lido".
 * `leituraDoSeloVazia` (estado-do-anexo.ts) é quem reconhece esta forma pelos
 * nomes dos campos: sem eles (ou nulos/em branco), a leitura é vazia mesmo
 * sendo um objeto e não `null`.
 */
const extracaoVaziaComoObjeto = (): SeloResult["extraction"] => ({
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
  extraction: extracaoLegivel(),
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

/*
 * FIX ROUND 1 (15/09/2026, revisão da Tarefa 18) — CRÍTICO.
 *
 * `VERSAO_DO_LEITOR` (3 aqui; 4 desde a revisão final) já impede a MESMA chave de servir uma leitura
 * de antes do conserto: a chave muda, o cache erra, a folha relê. Mas nada
 * garante que um registro já gravado sob a versão atual — por um bug futuro
 * que esqueça de aplicar `leituraDoSeloVazia` antes de guardar, por exemplo —
 * não chegue aqui com o mesmo objeto vazio truthy. `reidratar` é a ÚLTIMA
 * parada antes da leitura voltar ao Nexo, e é onde a segunda defesa mora.
 */
test("leitura vazia guardada como objeto (qualquer versão) volta como não lida", () => {
  const guardada = [folha(1, 1, { extraction: extracaoVaziaComoObjeto() })];
  const [r] = reidratar(guardada, "EST-01.pdf");
  assert.equal(r.extraction, null);
  assert.equal(r.vazia, true);
  assert.equal(typeof r.error, "string");
});

test("leitura legível não é tocada pela defesa da leitura vazia", () => {
  const guardada = [folha(1, 1)];
  const [r] = reidratar(guardada, "EST-01.pdf");
  assert.notEqual(r.extraction, null);
  assert.equal(r.vazia, undefined);
});

/*
 * FIX ROUND 1 — IMPORTANTE.
 *
 * Antes, `leituraCompleta` recusava QUALQUER `error`, e a leitura vazia
 * (êxito, carimbo em branco — `vazia: true`) carrega `error` para a tela
 * avisar. Sem esta distinção, a mesma prancha sem carimbo pagava uma chamada
 * de modelo a CADA reanexação só para redescobrir, de novo, que está vazia.
 */
test("folha vazia (leu, carimbo em branco) guarda igual, mesmo com error", () => {
  const vazia = folha(2, 2, {
    extraction: null,
    error: "O carimbo voltou sem nenhum campo legível.",
    vazia: true,
  });
  assert.equal(leituraCompleta([folha(1, 2), vazia]), true);
});

test("falha transitória (sem `vazia`) continua fora do cache", () => {
  const falhaTransitoria = folha(2, 2, { extraction: null, error: "timeout" });
  assert.equal(leituraCompleta([folha(1, 2), falhaTransitoria]), false);
});

console.log(`\n${passed} testes ok`);
