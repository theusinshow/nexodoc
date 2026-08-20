/**
 * Smoke-test do título vindo do carimbo. Núcleo PURO → node cru:
 *
 *   node scripts/test-nexo-titulo-do-selo.ts
 */
import assert from "node:assert/strict";

import { tituloDoSelo, titulosPropostos } from "../modules/nexo/lib/titulo-do-selo.ts";
import type { SeloForLd } from "../server/nexo/build-ld-proposal.ts";

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

const folha = (obra: string | null): SeloForLd =>
  ({
    fileName: "f.pdf",
    disciplina: null,
    folha: null,
    total: null,
    numeroFolha: null,
    arquivo: null,
    conteudo: null,
    cliente: null,
    secretaria: null,
    obra,
    fase: null,
    tituloSecao: null,
  }) as SeloForLd;

test("todas as folhas concordam — preenche", () => {
  const r = tituloDoSelo([folha("REFORMA DA CANCHA DE BOCHA"), folha("REFORMA DA CANCHA DE BOCHA")]);
  assert.equal(r.valor, "REFORMA DA CANCHA DE BOCHA");
  assert.equal(r.apoio, 2);
  assert.equal(r.divergentes, 0);
});

test("uma prancha reaproveitada não nomeia o volume", () => {
  // Dominância, não "o primeiro que aparecer".
  const r = tituloDoSelo([
    folha("CENTRO COMUNITARIO PRIMEIRA LINHA"),
    folha("REFORMA DA CANCHA DE BOCHA"),
    folha("REFORMA DA CANCHA DE BOCHA"),
    folha("REFORMA DA CANCHA DE BOCHA"),
  ]);
  assert.equal(r.valor, "REFORMA DA CANCHA DE BOCHA");
  assert.equal(r.divergentes, 1, "a divergente precisa ser contada para a tela avisar");
});

test("EMPATE não preenche — vira pergunta", () => {
  const r = tituloDoSelo([folha("OBRA A"), folha("OBRA B")]);
  assert.equal(r.valor, "", "escolher no empate seria palpite");
  assert.equal(r.divergentes, 2);
});

test("caixa e acento não criam títulos diferentes", () => {
  const r = tituloDoSelo([folha("Reforma da Praça"), folha("REFORMA DA PRACA")]);
  assert.equal(r.apoio, 2);
  assert.equal(r.divergentes, 0);
});

test("selo sem obra, ou com lixo curto, não preenche", () => {
  assert.equal(tituloDoSelo([folha(null), folha("  "), folha("ab")]).valor, "");
});

test("espaço extra do pdfjs não separa o mesmo título", () => {
  const r = tituloDoSelo([folha("REFORMA  DA   CANCHA"), folha("REFORMA DA CANCHA")]);
  assert.equal(r.apoio, 2);
});

// ---------------------------------------------------------------------------
// ONDE o titulo do carimbo entra -- `titulosPropostos`
// ---------------------------------------------------------------------------
//
// O carimbo da o nome do EMPREENDIMENTO, que e o titulo da CAPA. O titulo da LD
// e outro: e o nome de documento da DISCIPLINA, do lexico lido de 91 capas
// reais. Preencher os dois com o mesmo valor fez toda LD imprimir o nome da
// obra como cabecalho de secao -- e num volume misto, as quatro LDs saiam com o
// mesmo titulo, no lugar de "PROJETO ESTRUTURAL CONCRETO", "PROJETO
// HIDROSSANITARIO"...

const carimbo = (valor: string) => ({ valor, apoio: 3, divergentes: 0 });

test("o carimbo nomeia a CAPA, e deixa a LD para o lexico", () => {
  const r = titulosPropostos({}, carimbo("REFORMA E AMPLIACAO DA ESCOLA X"));
  assert.equal(r.tituloCapa, "REFORMA E AMPLIACAO DA ESCOLA X");
  assert.equal(r.tituloLd, "", "vazio e o que deixa o lexico responder pela disciplina");
});

test("titulo de LD pedido na conversa vence o lexico", () => {
  const r = titulosPropostos({ ld: "BLOCO B" }, carimbo("REFORMA DA ESCOLA X"));
  assert.equal(r.tituloLd, "BLOCO B");
  assert.equal(r.tituloCapa, "REFORMA DA ESCOLA X");
});

test("titulo de capa pedido na conversa vence o carimbo", () => {
  const r = titulosPropostos({ capa: "VOLUME UNICO" }, carimbo("REFORMA DA ESCOLA X"));
  assert.equal(r.tituloCapa, "VOLUME UNICO");
});

test("carimbo sem apoio (empate) nao preenche nada", () => {
  const r = titulosPropostos({}, { valor: "", apoio: 0, divergentes: 4 });
  assert.equal(r.tituloCapa, "");
  assert.equal(r.tituloLd, "");
});

test("so espaco nao e decisao: cai no carimbo", () => {
  const r = titulosPropostos({ capa: "   " }, carimbo("REFORMA DA ESCOLA X"));
  assert.equal(r.tituloCapa, "REFORMA DA ESCOLA X");
});

// ---------------------------------------------------------------------------
// O QUE VAI NO SLOT DO TITULO DA CAPA -- e nao e a obra
// ---------------------------------------------------------------------------
//
// Medido em 20/08/2026 contra a capa que o escritorio entregou no volume 10 de
// 040-26. A capa tem DOIS slots distintos, e a obra ja ocupa o primeiro:
//
//   PREFEITURA MUNICIPAL DE CHAPECO
//   SECRETARIA DE DESENVOLVIMENTO SUSTENTAVEL E OBRAS ESTRUTURANTES - SEDES
//   REVITALIZACAO DA FEIRA MUNICIPAL DE CHAPECO      <- a obra
//   PROJETO EXECUTIVO
//   PROJETO HIDROSSANITARIO                          <- o slot do titulo
//   PROJETO PREVENTIVO
//   PROJETO SPDA
//   Vol. X   JUNHO/2026   040_26
//
// O Nexo imprimia a obra NOS DOIS, entao "REVITALIZACAO DA FEIRA MUNICIPAL DE
// CHAPECO" saia duas vezes e as disciplinas do volume nao apareciam em lugar
// nenhum. Quem le a capa nao ficava sabendo o que ha dentro.
//
// A lista de disciplinas ja era montada (uma linha por bloco, do lexico) e
// servia so de fantasma no campo. Agora ela e o padrao, e a obra vira o ultimo
// recurso -- para o volume cuja disciplina o lexico nao conhece.

const DISCIPLINAS_DO_VOLUME = ["PROJETO HIDROSSANITARIO", "PROJETO PREVENTIVO", "PROJETO SPDA"].join("\n");

test("a capa leva as disciplinas do volume, nao a obra", () => {
  const r = titulosPropostos({}, carimbo("REVITALIZACAO DA FEIRA"), DISCIPLINAS_DO_VOLUME);
  assert.equal(r.tituloCapa, DISCIPLINAS_DO_VOLUME);
});

test("uma disciplina so continua saindo em uma linha", () => {
  const r = titulosPropostos({}, carimbo("REFORMA DA ESCOLA"), "PROJETO ESTRUTURAL");
  assert.equal(r.tituloCapa, "PROJETO ESTRUTURAL");
});

test("sem disciplina conhecida, a obra volta a ser o titulo", () => {
  const r = titulosPropostos({}, carimbo("REFORMA DA ESCOLA"), "");
  assert.equal(r.tituloCapa, "REFORMA DA ESCOLA");
});

test("o que o agente propos vence a lista", () => {
  const r = titulosPropostos({ capa: "PROJETO DE COISA" }, carimbo("OBRA"), DISCIPLINAS_DO_VOLUME);
  assert.equal(r.tituloCapa, "PROJETO DE COISA");
});

test("a lista de disciplinas nao contamina o titulo da LD", () => {
  const r = titulosPropostos({}, carimbo("OBRA"), DISCIPLINAS_DO_VOLUME);
  assert.equal(r.tituloLd, "", "vazio e o que deixa o lexico responder pela disciplina");
});

console.log(`\n${passed} testes ok`);
