/**
 * QUAIS BLOCOS NINGUÉM LEU — puro, sem token e sem rede.
 *
 *   node scripts/test-conferente-rede.ts
 *
 * Esta é a conta que decide QUANTO a rede de arrasto vai varrer, e errá-la tem
 * dois estragos opostos:
 *
 *  - contar demais enche o parecer de achados de rede sobre páginas que o `sol`
 *    acabou de ler com atenção. No Profundo isso seria o documento inteiro,
 *    porque lá o plano de blocos é ZERO por desenho;
 *  - contar de menos devolve o silêncio de hoje.
 *
 * O `parValeAPergunta` do Encaixe 4 está aqui pelo mesmo motivo: ele é o filtro
 * determinístico que evita perguntar 1.540 pares num parecer de 56 achados.
 */
import assert from "node:assert/strict";

import type { AuditTextChunk } from "../lib/pdf-text.ts";
import { blocosNaoLidos } from "../lib/conferente/encaixe-2-rede.ts";
import { parValeAPergunta } from "../lib/conferente/encaixe-4-dedupe.ts";
import type { AuditFinding } from "../lib/audit-report.ts";

let passed = 0;

function test(nome: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${nome}`);
  } catch (erro) {
    console.error(`FALHOU  ${nome}`);
    console.error(erro);
    process.exitCode = 1;
  }
}

function bloco(id: string, chars: number, startPage = 1): AuditTextChunk {
  return {
    id,
    title: `Capitulo ${id}`,
    startPage,
    endPage: startPage,
    text: "x".repeat(chars),
  };
}

const BLOCOS = [bloco("a", 1000, 1), bloco("b", 1000, 5), bloco("c", 1000, 9)];

test("a global que leu TUDO nao deixa buraco (o caso do Profundo)", () => {
  /*
   * O caso que mais importa. No Profundo `chunks` e vazio de proposito, porque
   * a leitura global manda o documento inteiro. Tratar "nao esta em chunks"
   * como "ninguem leu" varreria o documento inteiro em TODA corrida Profunda.
   */
  assert.deepEqual(blocosNaoLidos(BLOCOS, new Set(), 3000), []);
});

test("a global truncada deixa buraco a partir de onde ela parou", () => {
  const naoLidos = blocosNaoLidos(BLOCOS, new Set(), 1000);
  assert.deepEqual(naoLidos.map((b) => b.id), ["b", "c"]);
});

test("bloco cortado ao meio pelo teto conta como NAO lido", () => {
  /*
   * A global levou 1.500 dos 2.000 primeiros caracteres: o bloco "b" foi visto
   * pela metade. Meia leitura nao e leitura — e e exatamente no fim do bloco
   * cortado que o achado se perde.
   */
  const naoLidos = blocosNaoLidos(BLOCOS, new Set(), 1500);
  assert.deepEqual(naoLidos.map((b) => b.id), ["b", "c"]);
});

test("bloco que foi ao modelo por bloco nao e varrido de novo", () => {
  const naoLidos = blocosNaoLidos(BLOCOS, new Set(["b"]), 0);
  assert.deepEqual(naoLidos.map((b) => b.id), ["a", "c"]);
});

test("sem global e sem blocos, tudo e buraco", () => {
  assert.equal(blocosNaoLidos(BLOCOS, new Set(), 0).length, 3);
});

// --- Encaixe 4: o filtro deterministico de pares ----------------------------
function achado(id: string, arquivo: string, pagina: string): AuditFinding {
  return {
    id,
    arquivo,
    origem: "ia",
    confianca: "alta",
    prioridade: "Media",
    pagina,
    capitulo: "",
    local: "",
    tipo: "",
    descricao: "",
    evidencia: "",
    conflito: "",
    sugestao_correcao: "",
  } as AuditFinding;
}

test("par de arquivos diferentes nunca e perguntado", () => {
  assert.equal(
    parValeAPergunta(achado("1", "a.pdf", "10"), achado("2", "b.pdf", "10")),
    false,
  );
});

test("par a 40 paginas de distancia nunca e perguntado", () => {
  assert.equal(
    parValeAPergunta(achado("1", "a.pdf", "10"), achado("2", "a.pdf", "50")),
    false,
  );
});

test("par na mesma pagina, ou vizinha, vale a pergunta", () => {
  assert.equal(parValeAPergunta(achado("1", "a.pdf", "10"), achado("2", "a.pdf", "10")), true);
  assert.equal(parValeAPergunta(achado("1", "a.pdf", "10"), achado("2", "a.pdf", "11")), true);
});

test("intervalo de paginas casa com qualquer uma das pontas", () => {
  // "18-19" e "19" sao o mesmo lugar do documento.
  assert.equal(parValeAPergunta(achado("1", "a.pdf", "18-19"), achado("2", "a.pdf", "19")), true);
});

test("achado sem pagina nunca e pareado", () => {
  assert.equal(parValeAPergunta(achado("1", "a.pdf", ""), achado("2", "a.pdf", "10")), false);
});

console.log(`\n${passed} teste(s) OK`);
