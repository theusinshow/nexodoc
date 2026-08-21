/**
 * A disciplina lida do cabeçalho da página. Núcleo PURO → node cru.
 *
 *   node scripts/test-disciplina-da-pagina.ts   (== npm run test:disciplina-da-pagina)
 *
 * O QUE ESTÁ EM JOGO
 *
 * Um capítulo ocupa várias páginas e só a primeira traz o título inteiro. Logo,
 * a regra tem de CARREGAR o que sabe adiante — e tem de parar de carregar na
 * hora certa. Errar para o lado de carregar demais é pior do que não saber:
 * "13 - CONSIDERAÇÕES FINAIS" viraria elétrica só por vir depois da elétrica, e
 * o documento inteiro herdaria a primeira disciplina que aparecesse. Metade
 * destes testes é sobre esse limite.
 */
import assert from "node:assert/strict";

import { disciplinaPorPagina, disciplinaDoAchado } from "../lib/disciplina-da-pagina.ts";

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

const pagina = (page: number, text: string) => ({ page, text });

test("o cabeçalho do capítulo dá a disciplina da página", () => {
  const mapa = disciplinaPorPagina([
    pagina(1, "12 - INSTALACOES ELETRICAS o quadro geral de protecao sera instalado"),
  ]);
  assert.equal(mapa.get(1), "eletrico");
});

test("página sem cabeçalho HERDA o capítulo em vigor", () => {
  const mapa = disciplinaPorPagina([
    pagina(1, "12 - INSTALACOES ELETRICAS texto de abertura do capitulo"),
    pagina(2, "os condutores serao de cobre com isolacao para 750V conforme projeto"),
    pagina(3, "as luminarias seguem o especificado em planilha anexa a este memorial"),
  ]);
  assert.equal(mapa.get(2), "eletrico");
  assert.equal(mapa.get(3), "eletrico");
});

test("capítulo NOVO sem disciplina zera — não herda o anterior", () => {
  /*
   * O caso que faria a regra contaminar o documento: uma vez achada a primeira
   * disciplina, ela valeria até o fim se o capítulo novo não a derrubasse.
   */
  const mapa = disciplinaPorPagina([
    pagina(1, "12 - INSTALACOES ELETRICAS abertura"),
    pagina(2, "13 - CONSIDERACOES FINAIS o presente memorial encerra a descricao"),
    pagina(3, "as entregas seguem o cronograma pactuado em contrato entre as partes"),
  ]);
  assert.equal(mapa.get(1), "eletrico");
  assert.equal(mapa.get(2), undefined);
  assert.equal(mapa.get(3), undefined);
});

test("capítulo novo COM outra disciplina troca de verdade", () => {
  const mapa = disciplinaPorPagina([
    pagina(1, "12 - INSTALACOES ELETRICAS abertura do capitulo de eletrica"),
    pagina(2, "13 - INSTALACOES HIDROSSANITARIAS agua fria e esgoto do conjunto"),
    pagina(3, "os ramais seguem embutidos em alvenaria conforme detalhe de projeto"),
  ]);
  assert.equal(mapa.get(1), "eletrico");
  assert.equal(mapa.get(2), "hidrossanitario");
  assert.equal(mapa.get(3), "hidrossanitario");
});

test("página fora do mapa não vira 'geral' — vira ausência", () => {
  /*
   * A diferença importa: `undefined` deixa a inferência antiga responder;
   * "geral" seria uma afirmação sem base, e apagaria o fallback.
   */
  const mapa = disciplinaPorPagina([
    pagina(1, "texto corrido de abertura sem numero nem titulo de capitulo algum"),
  ]);
  assert.equal(mapa.get(1), undefined);
  assert.equal(mapa.size, 0);
});

test("o achado pega a disciplina pela página que cita", () => {
  const mapa = disciplinaPorPagina([
    pagina(1, "12 - INSTALACOES ELETRICAS abertura"),
    pagina(2, "continuacao do texto de eletrica sem cabecalho proprio nesta folha"),
  ]);
  assert.equal(disciplinaDoAchado("2", mapa), "eletrico");
});

test("intervalo de páginas vale pela primeira, como o pin do parecer", () => {
  const mapa = disciplinaPorPagina([
    pagina(4, "8 - PREVENCAO E COMBATE A INCENDIO hidrantes e extintores da edificacao"),
    pagina(5, "continuacao"),
  ]);
  assert.equal(disciplinaDoAchado("4-5", mapa), "ppci");
});

test("achado sem página não recebe disciplina", () => {
  const mapa = disciplinaPorPagina([pagina(1, "12 - INSTALACOES ELETRICAS abertura")]);
  assert.equal(disciplinaDoAchado("nao informada", mapa), undefined);
  assert.equal(disciplinaDoAchado(undefined, mapa), undefined);
});

test("achado numa página que o mapa não conhece cai no fallback", () => {
  const mapa = disciplinaPorPagina([pagina(1, "12 - INSTALACOES ELETRICAS abertura")]);
  assert.equal(disciplinaDoAchado("99", mapa), undefined);
});

test("documento vazio devolve mapa vazio", () => {
  assert.equal(disciplinaPorPagina([]).size, 0);
});

/*
 * O TÍTULO COMPOSTO — o defeito mais caro que estes testes não pegavam.
 *
 * Medido no memorial do 113-22 (21/08/2026): a página 28 diz "3 - PROJETO
 * ARQUITETÔNICO E URBANIZAÇÃO" e as 29 a 81 dizem "3 - PROJETO ARQUITETÔNICO",
 * limpo. Como é o MESMO capítulo 3, a continuidade não revisa o que já sabe —
 * e "urbaniza" casava antes de "arquitetonic" só porque a regra de
 * terraplenagem vem antes na lista. Resultado: 54 das 113 páginas mapeadas de
 * um memorial de hospital saíam como terraplenagem, e a tela as mostrava como
 * fato lido do documento.
 *
 * Os três casos juntos, porque o defeito é a INTERAÇÃO: o desempate errado
 * sozinho erra uma página, e é a continuidade que o espalha por cinquenta.
 */
test("título composto vale pelo substantivo da frente, não pela ordem das regras", () => {
  const mapa = disciplinaPorPagina([
    pagina(1, "3 - PROJETO ARQUITETONICO E URBANIZACAO abertura do capitulo"),
  ]);
  assert.equal(mapa.get(1), "arquitetura");
});

test("e o capítulo inteiro vai junto, e não só a página do título", () => {
  const mapa = disciplinaPorPagina([
    pagina(1, "3 - PROJETO ARQUITETONICO E URBANIZACAO abertura do capitulo"),
    pagina(2, "3 - PROJETO ARQUITETONICO as esquadrias seguem o especificado"),
    pagina(3, "3.1 Demolicoes e retiradas o construtor devera remover o existente"),
  ]);
  assert.equal(mapa.get(2), "arquitetura");
  assert.equal(mapa.get(3), "arquitetura");
});

test("mas urbanização SOZINHA continua sendo terraplenagem", () => {
  /*
   * A metade que impede a correção de virar "arquitetura sempre ganha": o
   * 117-25 tem "5 PROJETO DE URBANIZAÇÃO" como capítulo próprio, e ali os dez
   * achados de espessura de camada e meio-fio são de terraplenagem de verdade.
   */
  const mapa = disciplinaPorPagina([
    pagina(1, "5 - PROJETO DE URBANIZACAO camada de assentamento e meio-fio"),
  ]);
  assert.equal(mapa.get(1), "terraplenagem");
});

console.log(`\n${passed} teste(s) OK`);
