/**
 * Teste do CÂMBIO DECLARADO e do CUSTO POR OBRA — as duas metades do A.7 que
 * dão para provar sem banco e sem navegador.
 *
 * O que está travado aqui é sobretudo o que o painel NÃO pode fazer: inventar
 * real quando não há cotação, e sumir com o consumo que não tem obra.
 *
 *   node scripts/test-cambio.ts   (== npm run test:cambio)
 */
import assert from "node:assert/strict";

import {
  COTACAO_NAO_DECLARADA,
  cotacaoDeclarada,
  emReais,
  formatarReais,
  idadeDaCotacaoEmDias,
  normalizarCotacao,
  procedenciaDaCotacao,
  validarCotacao,
} from "../lib/cambio.ts";
import { custoPorObra } from "../lib/custo-por-obra.ts";

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

const AGORA = new Date("2026-08-13T12:00:00Z");
const COTACAO = normalizarCotacao({
  valor: "5,42",
  declaradaEm: "2026-08-10T09:00:00Z",
  declaradaPor: "admin",
});

test("a vírgula do teclado brasileiro é aceita", () => {
  assert.equal(COTACAO.valor, 5.42);
  assert.equal(normalizarCotacao({ valor: "5.42" }).valor, 5.42);
});

test("lixo e negativo viram cotação não declarada", () => {
  assert.equal(normalizarCotacao({ valor: "abc" }).valor, 0);
  assert.equal(normalizarCotacao({ valor: -3 }).valor, 0);
  assert.equal(normalizarCotacao(null).valor, 0);
  assert.equal(cotacaoDeclarada(COTACAO_NAO_DECLARADA), false);
});

test("a validação segura o dedo escorregado", () => {
  assert.deepEqual(validarCotacao(COTACAO), []);
  assert.equal(validarCotacao(normalizarCotacao({ valor: 5420 })).length, 1);
  // Zerada é válida: é como se apaga a cotação.
  assert.deepEqual(validarCotacao(COTACAO_NAO_DECLARADA), []);
});

test("SEM COTAÇÃO NÃO HÁ REAL — nem R$ 0,00", () => {
  assert.equal(emReais(12.4, COTACAO_NAO_DECLARADA), null);
  assert.equal(formatarReais(12.4, COTACAO_NAO_DECLARADA), "");
});

test("com cotação, o real sai sempre com ≈", () => {
  assert.equal(emReais(10, COTACAO), 54.2);
  const texto = formatarReais(10, COTACAO);
  assert.ok(texto.startsWith("≈ "), texto);
  assert.ok(texto.includes("54,20"), texto);
});

test("dólar ausente não vira zero", () => {
  assert.equal(emReais(null, COTACAO), null);
  assert.equal(formatarReais(undefined, COTACAO), "");
});

test("a procedência diz de quando é o número", () => {
  assert.equal(idadeDaCotacaoEmDias(COTACAO, AGORA), 3);
  const linha = procedenciaDaCotacao(COTACAO, AGORA);
  assert.ok(linha.includes("há 3 dias"), linha);
  assert.ok(linha.includes("5,42"), linha);
});

test("cotação velha pede revisão; sem cotação, a linha explica o dólar", () => {
  const velha = normalizarCotacao({ valor: 5, declaradaEm: "2026-06-01T00:00:00Z" });
  assert.ok(procedenciaDaCotacao(velha, AGORA).includes("vale revisar"));
  assert.ok(
    procedenciaDaCotacao(COTACAO_NAO_DECLARADA, AGORA).includes("não declarada"),
  );
});

// --- custo por obra ---

const CONVERSAS = [
  { id: "c1", title: "LD da Aurora", folderKey: "Residencial Aurora" },
  { id: "c2", title: "Capa da Aurora", folderKey: "Residencial Aurora" },
  { id: "c3", title: "Memorial avulso", folderKey: null },
];

const EVENTOS = [
  { conversationId: "c1", estimatedCostUsd: 20, totalTokens: 1000 },
  { conversationId: "c2", estimatedCostUsd: 11.8, totalTokens: 500 },
  { conversationId: "c3", estimatedCostUsd: 4, totalTokens: 200 },
  { conversationId: null, estimatedCostUsd: 90, totalTokens: 9000 },
  { conversationId: "sumida", estimatedCostUsd: 2, totalTokens: 100 },
];

test("a pasta é a obra, e duas conversas somam numa linha só", () => {
  const linhas = custoPorObra(EVENTOS, CONVERSAS);
  const aurora = linhas.find((l) => l.obra === "Residencial Aurora");
  assert.equal(aurora?.estimatedCostUsd, 31.8);
  assert.equal(aurora?.conversas, 2);
  assert.equal(aurora?.requests, 2);
  assert.equal(aurora?.origem, "pasta");
});

test("conversa fora de pasta é uma obra de uma conversa só", () => {
  const linhas = custoPorObra(EVENTOS, CONVERSAS);
  const avulsa = linhas.find((l) => l.obra === "Memorial avulso");
  assert.equal(avulsa?.origem, "conversa");
  assert.equal(avulsa?.estimatedCostUsd, 4);
});

test("O QUE NÃO TEM OBRA NÃO SOME — e vai para o fim mesmo sendo o maior", () => {
  const linhas = custoPorObra(EVENTOS, CONVERSAS);
  const semVinculo = linhas.find((l) => l.origem === "sem-vinculo");
  const removida = linhas.find((l) => l.origem === "conversa-removida");

  assert.equal(semVinculo?.estimatedCostUsd, 90);
  assert.equal(removida?.estimatedCostUsd, 2);
  assert.equal(linhas[0].obra, "Residencial Aurora", "a obra mais cara abre a tabela");
  assert.ok(
    linhas.indexOf(semVinculo!) > linhas.indexOf(linhas.find((l) => l.origem === "conversa")!),
    "sem vínculo tem de ficar depois das obras",
  );
});

test("a tabela soma exatamente o total do período", () => {
  const linhas = custoPorObra(EVENTOS, CONVERSAS);
  const soma = linhas.reduce((t, l) => t + l.estimatedCostUsd, 0);
  const total = EVENTOS.reduce((t, e) => t + (e.estimatedCostUsd ?? 0), 0);
  assert.equal(Math.round(soma * 100), Math.round(total * 100));
});

test("custo nulo não quebra a soma", () => {
  const linhas = custoPorObra([{ conversationId: "c1", estimatedCostUsd: null, totalTokens: 7 }], CONVERSAS);
  assert.equal(linhas[0].estimatedCostUsd, 0);
  assert.equal(linhas[0].totalTokens, 7);
});

console.log(`\n${passed} teste(s) passaram.`);
