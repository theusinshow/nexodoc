/**
 * As decisões de REUSO entre duas revisões do mesmo memorial.
 *
 * Todas determinísticas e sem token: é o módulo que decide o que o modelo vai
 * reler e qual achado sobrevive. Errar aqui é caro dos dois lados — herdar
 * achado com página errada manda o engenheiro para a folha errada; deixar de
 * herdar faz o parecer encolher sem ninguém pedir.
 *
 *   node scripts/test-audit-reuso.ts   (== npm run test:audit:reuso)
 */
import assert from "node:assert/strict";

import {
  capituloDoAchado,
  paginaDoAchado,
  planejarReuso,
  reancorarPorAritmetica,
  reancorarPorTermo,
} from "../lib/audit-reuso.ts";
import type { AuditFinding, CapituloImpresso } from "../lib/audit-report.ts";
import type { ExtractedPdfPage } from "../lib/pdf-text.ts";

/*
 * A versao do auditor virou um HASH derivado da configuracao real (ver
 * [[versao-do-auditor.ts]]). Para estas decisoes o valor e opaco: o que
 * importa e ser igual ou diferente da anterior.
 */
const VERSAO = "abc123def456";
const OUTRA_VERSAO = "999999999999";

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

const cap = (
  titulo: string,
  startPage: number,
  endPage: number,
  hash: string,
): CapituloImpresso => ({ titulo, startPage, endPage, chars: 1000, hash });

// Três capítulos com o MESMO título — a armadilha real destes memoriais.
const CAPITULOS = [
  cap("1 - APRESENTACAO", 1, 3, "h1"),
  cap("2 - ARQUITETURA", 4, 9, "h2"),
  cap("1 - APRESENTACAO", 10, 12, "h3"),
];

test("página simples vira número", () => {
  assert.equal(paginaDoAchado("7"), 7);
  assert.equal(paginaDoAchado(" 12 "), 12);
});

test("página composta usa a primeira — é onde o visor abre", () => {
  assert.equal(paginaDoAchado("11 e 14"), 11);
  assert.equal(paginaDoAchado("pág. 5"), 5);
});

test("página ilegível devolve null, nunca zero", () => {
  assert.equal(paginaDoAchado(""), null);
  assert.equal(paginaDoAchado("não informada"), null);
});

test("achado cai no capítulo cuja FAIXA o contém", () => {
  assert.equal(capituloDoAchado("5", CAPITULOS)?.hash, "h2");
  assert.equal(capituloDoAchado("1", CAPITULOS)?.hash, "h1");
});

test("título repetido não confunde — quem decide é a página", () => {
  // Os capítulos 1 e 3 têm título idêntico; o achado da página 11 pertence ao
  // terceiro, e nenhuma comparação de texto conseguiria distinguir.
  assert.equal(capituloDoAchado("11", CAPITULOS)?.hash, "h3");
});

test("página fora de qualquer faixa devolve null", () => {
  assert.equal(capituloDoAchado("99", CAPITULOS), null);
  assert.equal(capituloDoAchado("", CAPITULOS), null);
});

test("capítulo que andou junto: a página do achado anda o mesmo tanto", () => {
  // Entrou um capítulo antes dele; o capítulo em si é idêntico (mesmo hash) e
  // ocupa o mesmo número de páginas. Tudo depois andou +3.
  const antes = cap("3 - FUNDACOES", 20, 24, "hf");
  const agora = cap("3 - FUNDACOES", 23, 27, "hf");
  assert.equal(reancorarPorAritmetica("21", antes, agora), 24);
  assert.equal(reancorarPorAritmetica("20", antes, agora), 23);
});

test("capítulo parado devolve a mesma página", () => {
  const c = cap("3 - FUNDACOES", 20, 24, "hf");
  assert.equal(reancorarPorAritmetica("22", c, c), 22);
});

test("capítulo que passou a ocupar outro número de páginas NÃO usa aritmética", () => {
  // Mesmo texto, mas as quebras internas mudaram: a soma uniforme mentiria.
  const antes = cap("3 - FUNDACOES", 20, 24, "hf");
  const agora = cap("3 - FUNDACOES", 23, 28, "hf");
  assert.equal(reancorarPorAritmetica("21", antes, agora), null);
});

test("página fora da faixa antiga não é reancorada", () => {
  const antes = cap("3 - FUNDACOES", 20, 24, "hf");
  const agora = cap("3 - FUNDACOES", 23, 27, "hf");
  assert.equal(reancorarPorAritmetica("40", antes, agora), null);
  assert.equal(reancorarPorAritmetica("sem página", antes, agora), null);
});

const PAGINAS: ExtractedPdfPage[] = [
  { page: 1, text: "Memorial descritivo da obra." },
  { page: 2, text: "As fundacoes serao em estacas escavadas de 40cm." },
  { page: 3, text: "Concreto  fck   25   MPa para todas as pecas." },
];

test("termo encontrado devolve a página em que está", () => {
  assert.equal(reancorarPorTermo("estacas escavadas", PAGINAS), 2);
});

test("espaço em excesso não impede o encontro", () => {
  // O texto do PDF vem com espaçamento irregular; o termo do achado, não.
  assert.equal(reancorarPorTermo("fck 25 MPa", PAGINAS), 3);
});

test("acento e caixa não impedem o encontro", () => {
  assert.equal(reancorarPorTermo("FUNDAÇÕES SERÃO", PAGINAS), 2);
});

test("termo ausente devolve null — quem chama decide o que fazer", () => {
  assert.equal(reancorarPorTermo("laje nervurada", PAGINAS), null);
  assert.equal(reancorarPorTermo(undefined, PAGINAS), null);
  assert.equal(reancorarPorTermo("   ", PAGINAS), null);
});

const achado = (
  id: string,
  pagina: string,
  origem: "ia" | "regra",
  termo?: string,
): AuditFinding => ({
  id,
  pagina,
  capitulo: "irrelevante",
  local: "",
  tipo: "t",
  descricao: "d",
  evidencia: "e",
  conflito: "c",
  sugestao_correcao: "s",
  prioridade: "Media",
  confianca: "alta",
  origem,
  termo_busca: termo,
});

// Antes: dois capítulos. Agora: entrou um capítulo novo antes do segundo.
const A1 = cap("1 - GENERALIDADES", 1, 3, "hA");
const A2 = cap("2 - FUNDACOES", 4, 8, "hB");
const N1 = cap("1 - GENERALIDADES", 1, 3, "hA");
const NOVO = cap("1.5 - METALICO", 4, 6, "hNOVO");
const N2 = cap("2 - FUNDACOES", 7, 11, "hB");

const DELTA_SIMPLES = {
  iguais: [N1, N2],
  alterados: [],
  novos: [NOVO],
  sumidos: [],
};

test("achado de capítulo igual é herdado com a página reancorada", () => {
  const plano = planejarReuso({
    delta: DELTA_SIMPLES,
    capitulosAntes: [A1, A2],
    achadosAntes: [achado("INC-1", "5", "ia")],
    paginasAgora: PAGINAS,
    versaoAnterior: VERSAO,
    versaoAtual: VERSAO,
  });
  assert.equal(plano.achadosHerdados.length, 1);
  assert.equal(plano.achadosHerdados[0].pagina, "8"); // 5 + (7-4)
  assert.deepEqual(
    plano.capitulosParaLer.map((c) => c.hash),
    ["hNOVO"],
  );
});

test("achado de REGRA nunca é herdado — as regras reprocessam de graça", () => {
  const plano = planejarReuso({
    delta: DELTA_SIMPLES,
    capitulosAntes: [A1, A2],
    achadosAntes: [achado("INC-1", "5", "regra")],
    paginasAgora: PAGINAS,
    versaoAnterior: VERSAO,
    versaoAtual: VERSAO,
  });
  assert.equal(plano.achadosHerdados.length, 0);
});

test("achado de capítulo que SUMIU não entra no parecer novo", () => {
  const plano = planejarReuso({
    delta: { iguais: [N1], alterados: [], novos: [], sumidos: [A2] },
    capitulosAntes: [A1, A2],
    achadosAntes: [achado("INC-1", "5", "ia")],
    paginasAgora: PAGINAS,
    versaoAnterior: VERSAO,
    versaoAtual: VERSAO,
  });
  assert.equal(plano.achadosHerdados.length, 0);
});

test("sem âncora, o capítulo inteiro volta a ser lido", () => {
  // Capítulo igual que passou a ocupar mais páginas (aritmética recusa) e cujo
  // achado não tem termo de busca: não há como reancorar.
  const antes = cap("2 - FUNDACOES", 4, 8, "hB");
  const agora = cap("2 - FUNDACOES", 7, 12, "hB");
  const plano = planejarReuso({
    delta: { iguais: [agora], alterados: [], novos: [], sumidos: [] },
    capitulosAntes: [antes],
    achadosAntes: [achado("INC-1", "5", "ia")],
    paginasAgora: PAGINAS,
    versaoAnterior: VERSAO,
    versaoAtual: VERSAO,
  });
  assert.equal(plano.achadosHerdados.length, 0);
  assert.deepEqual(
    plano.capitulosParaLer.map((c) => c.hash),
    ["hB"],
  );
  assert.deepEqual(plano.promovidos, [{ titulo: "2 - FUNDACOES", motivo: "sem-ancora" }]);
});

test("versão do auditor diferente: nada é herdado e tudo é lido", () => {
  const plano = planejarReuso({
    delta: DELTA_SIMPLES,
    capitulosAntes: [A1, A2],
    achadosAntes: [achado("INC-1", "5", "ia")],
    paginasAgora: PAGINAS,
    versaoAnterior: OUTRA_VERSAO,
    versaoAtual: VERSAO,
  });
  assert.equal(plano.achadosHerdados.length, 0);
  assert.equal(plano.capitulosParaLer.length, 3);
  assert.deepEqual(plano.hashesHerdados, []);
});

test("parecer sem versão gravada é tratado como incomparável", () => {
  const plano = planejarReuso({
    delta: DELTA_SIMPLES,
    capitulosAntes: [A1, A2],
    achadosAntes: [achado("INC-1", "5", "ia")],
    paginasAgora: PAGINAS,
    versaoAnterior: undefined,
    versaoAtual: VERSAO,
  });
  assert.equal(plano.achadosHerdados.length, 0);
  assert.equal(plano.capitulosParaLer.length, 3);
});

console.log(`\n${passed} verificações de reuso passaram.`);
