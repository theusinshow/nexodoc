/**
 * Teste do LÉXICO DE DISCIPLINAS — os três registros do nome.
 *
 * A capa usa o nome curto; a separatriz e a LD usam o longo; a interface usa o
 * de tela. Sete das vinte e quatro disciplinas divergem entre capa e documento,
 * e antes disto a LD de um volume misto saía com o rótulo de INTERFACE —
 * "HIDROSSANITARIO", sem acento — no documento entregue ao cliente.
 *
 * Os nomes foram lidos de 91 capas e separatrizes reais (040-26, 113-22,
 * 116-25, 156-25) e os quatro casos ambíguos foram fechados com o engenheiro
 * em 2026-08-06. Este teste é onde essa decisão fica registrada: quem mudar um
 * nome sem querer, quebra aqui.
 *
 *   node scripts/test-nexo-disciplinas.ts   (== npm run test:nexo:disciplinas)
 */
import assert from "node:assert/strict";

import {
  DISCIPLINAS,
  DISCIPLINA_LEXICON,
  disciplinaLabel,
  nomeDoPar,
  nomeNaCapa,
  nomeNoDocumento,
} from "../server/nexo/disciplinas.ts";

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

// ---------------------------------------------------------------------------
// As decisões do engenheiro (2026-08-06)
// ---------------------------------------------------------------------------

test("est é SEMPRE 'PROJETO ESTRUTURAL CONCRETO'", () => {
  // O 113-22 imprimia "DE CONCRETO ARMADO"; o padrão é o do 084-25.
  assert.equal(nomeNaCapa("est"), "PROJETO ESTRUTURAL CONCRETO");
  assert.equal(nomeNoDocumento("est"), "PROJETO ESTRUTURAL CONCRETO");
});

test("top é SEMPRE 'LEVANTAMENTO TOPOGRÁFICO'", () => {
  // O 156-25 usava a forma longa "PLANIALTIMÉTRICO E CADASTRAL"; não é o padrão.
  assert.equal(nomeNaCapa("top"), "LEVANTAMENTO TOPOGRÁFICO");
  assert.equal(nomeNoDocumento("top"), "LEVANTAMENTO TOPOGRÁFICO");
});

test("fnd tem nome, mesmo sem aparecer nas amostras", () => {
  assert.equal(nomeNaCapa("fnd"), "PROJETO DE FUNDAÇÕES");
});

test("gmt e ter existem SOZINHOS e como PAR", () => {
  // "Às vezes separados" — então os três nomes precisam existir.
  assert.equal(nomeNoDocumento("gmt"), "DESENHO GEOMÉTRICO");
  assert.equal(nomeNoDocumento("ter"), "PROJETO DE TERRAPLENAGEM");
  assert.equal(nomeDoPar("gmt", "ter"), "PROJETO DE GEOMETRIA E TERRAPLENAGEM");
});

test("o par não depende da ordem em que foi fundido", () => {
  assert.equal(nomeDoPar("ter", "gmt"), nomeDoPar("gmt", "ter"));
});

// ---------------------------------------------------------------------------
// A regra: capa curto, documento longo
// ---------------------------------------------------------------------------

test("os sete que DIVERGEM entre capa e documento", () => {
  const divergem = Object.entries(DISCIPLINAS)
    .filter(([, n]) => n.capa !== n.documento)
    .map(([codigo]) => codigo)
    .sort();
  assert.deepEqual(divergem, ["cab", "ele", "elt", "his", "inc", "lev", "spd"]);
});

test("a LD do hidrossanitário NÃO leva o nome de tela", () => {
  // Era o defeito: "HIDROSSANITARIO" (rótulo de chip) ia para o documento.
  assert.equal(nomeNoDocumento("his"), "PROJETO DE INSTALAÇÕES HIDROSSANITÁRIAS");
  assert.notEqual(nomeNoDocumento("his"), disciplinaLabel("his")?.toUpperCase());
});

test("as grafias irmãs dão o mesmo nome", () => {
  // `elt`/`ele` e `cft`/`cftv` são a mesma disciplina escrita de dois jeitos.
  assert.equal(nomeNoDocumento("ele"), nomeNoDocumento("elt"));
  assert.equal(nomeNoDocumento("cftv"), nomeNoDocumento("cft"));
});

// ---------------------------------------------------------------------------
// Integridade do léxico
// ---------------------------------------------------------------------------

test("todo código tem os três registros preenchidos", () => {
  for (const [codigo, n] of Object.entries(DISCIPLINAS)) {
    assert.ok(n.ui.trim(), `${codigo}: ui vazio`);
    assert.ok(n.capa.trim(), `${codigo}: capa vazio`);
    assert.ok(n.documento.trim(), `${codigo}: documento vazio`);
  }
});

test("capa e documento são MAIÚSCULOS (vão impressos assim)", () => {
  for (const [codigo, n] of Object.entries(DISCIPLINAS)) {
    assert.equal(n.capa, n.capa.toUpperCase(), `${codigo}: capa não é maiúscula`);
    assert.equal(n.documento, n.documento.toUpperCase(), `${codigo}: documento não é maiúsculo`);
  }
});

test("o mapa de compatibilidade é DERIVADO, não uma segunda lista", () => {
  for (const [codigo, n] of Object.entries(DISCIPLINAS)) {
    assert.equal(DISCIPLINA_LEXICON[codigo], n.ui, `${codigo} divergiu`);
  }
  assert.equal(
    Object.keys(DISCIPLINA_LEXICON).length,
    Object.keys(DISCIPLINAS).length,
  );
});

test("código desconhecido devolve undefined, não um nome inventado", () => {
  assert.equal(nomeNaCapa("xyz"), undefined);
  assert.equal(nomeNoDocumento("xyz"), undefined);
  assert.equal(nomeDoPar("xyz", "abc"), undefined);
});

/*
 * A CHAVE É O CÓDIGO, NUNCA O RÓTULO.
 *
 * `resumo.disciplina` do `buildLdProposal` é o rótulo de UI em maiúsculas
 * ("ESTRUTURAL"); a chave do léxico é o código de três letras ("est"). Passar o
 * rótulo devolve undefined — e quem derivasse o título da capa a partir dele
 * ganharia um título VAZIO em silêncio, com o slot voltando a perguntar como se
 * a derivação nem existisse. Foi o que aconteceu ao ligar `titulos` em
 * `slot-request.ts`, e é por isso que `resumo` carrega `disciplinaCode` à parte.
 */
test("o rótulo NÃO serve de chave — só o código", () => {
  assert.equal(nomeNaCapa("est"), "PROJETO ESTRUTURAL CONCRETO");
  assert.equal(nomeNaCapa("ESTRUTURAL"), undefined, "rótulo não é chave");
  assert.equal(nomeNaCapa("Estrutural"), undefined);
});

console.log(`\n${passed} teste(s) ok.`);
