/**
 * O ESTADO "ALTERAÇÃO PENDENTE" NO PLANO EM LOTE.
 *
 * O defeito que este teste tranca é o mais caro do produto: o plano dizia
 * "Gerado", com os checks verdes, DEPOIS que o engenheiro mudou o título, a
 * prefeitura ou a data. Ele contava só o `artifactId`, e o id é estável de
 * propósito (uma capa por conversa, atualizada no lugar). Então o PDF velho
 * continuava no canvas parecendo estar em dia, e o volume seguia para a
 * prefeitura com o documento errado — sem nada na tela avisando.
 *
 * A máquina de estado certa já existia e era usada nos cards individuais
 * (`estadoDoArtefato`): ela compara o payload que ORIGINOU o resultado com os
 * params de agora. O plano em lote simplesmente não a usava.
 *
 * A armadilha ao consertar é reimplementar a montagem do payload dentro do
 * card: as três formas são diferentes (a separatriz nem espalha `...params`,
 * e a LD carrega a assinatura das folhas), e qualquer divergência produziria
 * "pendente" ETERNO — um card que pede para gerar de novo e nunca fica em dia.
 * Por isso `payloadDoItem` é UMA função, usada por quem grava e por quem
 * compara. Este teste existe para que ela continue sendo uma só.
 *
 *   node scripts/test-nexo-plano-pendente.ts   (== npm run test:nexo:plano-pendente)
 */
import assert from "node:assert/strict";

import {
  payloadDoItem,
  type ItemDoPlano,
} from "../modules/nexo/lib/payload-do-item.ts";
import { estadoDoArtefato } from "../modules/nexo/lib/estado-do-artefato.ts";
import type { SeloForLd } from "../server/nexo/build-ld-proposal.ts";

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
// Cenário: um volume de uma disciplina, quatro folhas.
// ---------------------------------------------------------------------------

const selos = [
  { id: "f1", codigo: "ARQ-01", titulo: "PLANTA BAIXA", revisao: "00" },
  { id: "f2", codigo: "ARQ-02", titulo: "CORTES", revisao: "00" },
  { id: "f3", codigo: "ARQ-03", titulo: "FACHADAS", revisao: "00" },
  { id: "f4", codigo: "ARQ-04", titulo: "COBERTURA", revisao: "00" },
] as unknown as SeloForLd[];

function itemCapa(params: Record<string, unknown>): ItemDoPlano {
  return {
    kind: "capa",
    tomoAtual: 0,
    tomoNumero: 0,
    sufixo: "",
    params,
    rotulo: "Capa",
  };
}

const PARAMS_CAPA = {
  templateId: "criciuma",
  tituloCapa: "PROJETO ARQUITETÔNICO",
  volume: "I",
  mes: "08",
  ano: "2026",
};

// ---------------------------------------------------------------------------
// payloadDoItem: uma forma só de cunhar o payload
// ---------------------------------------------------------------------------

test("o payload da capa espalha os params e carrega o tomo", () => {
  const p = payloadDoItem({ item: itemCapa(PARAMS_CAPA), selos, tituloDaSeparatriz: "" });
  assert.deepEqual(p, { ...PARAMS_CAPA, tomo: 0 });
});

test("o payload é estável: mesma entrada, mesma saída", () => {
  const a = payloadDoItem({ item: itemCapa(PARAMS_CAPA), selos, tituloDaSeparatriz: "" });
  const b = payloadDoItem({ item: itemCapa(PARAMS_CAPA), selos, tituloDaSeparatriz: "" });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("a separatriz NÃO espalha os params — só título, tomo e o que for preciso", () => {
  const item: ItemDoPlano = {
    kind: "separatriz",
    tomoAtual: 0,
    tomoNumero: 0,
    sufixo: "",
    params: { titulos: [], lixo: "não deve vazar" },
    rotulo: "Separatriz",
  };
  const p = payloadDoItem({ item, selos, tituloDaSeparatriz: "PROJETO ARQUITETÔNICO" });
  assert.deepEqual(p, { titulo: "PROJETO ARQUITETÔNICO", tomo: 0 });
});

test("separatriz sem título nenhum não tem payload — a capa manda nela", () => {
  const item: ItemDoPlano = {
    kind: "separatriz",
    tomoAtual: 0,
    tomoNumero: 0,
    sufixo: "",
    params: {},
    rotulo: "Separatriz",
  };
  assert.equal(payloadDoItem({ item, selos, tituloDaSeparatriz: "" }), null);
});

test("uma separatriz só não ganha a chave `titulos` — ela faria toda separatriz já gerada parecer velha", () => {
  const item: ItemDoPlano = {
    kind: "separatriz",
    tomoAtual: 0,
    tomoNumero: 0,
    sufixo: "",
    params: { titulos: ["ELÉTRICA"] },
    rotulo: "Separatriz",
  };
  const p = payloadDoItem({ item, selos, tituloDaSeparatriz: "" }) as Record<string, unknown>;
  assert.equal(p.titulo, "ELÉTRICA");
  assert.equal("titulos" in p, false);
});

test("com mais de um título a chave `titulos` entra", () => {
  const item: ItemDoPlano = {
    kind: "separatriz",
    tomoAtual: 0,
    tomoNumero: 0,
    sufixo: "",
    params: { titulos: ["ELÉTRICA", "CFTV", "SPDA"] },
    rotulo: "Separatriz",
  };
  const p = payloadDoItem({ item, selos, tituloDaSeparatriz: "" }) as Record<string, unknown>;
  assert.deepEqual(p.titulos, ["ELÉTRICA", "CFTV", "SPDA"]);
});

test("o payload da LD carrega a assinatura das folhas", () => {
  const item: ItemDoPlano = {
    kind: "ld",
    tomoAtual: 0,
    tomoNumero: 0,
    sufixo: "",
    params: { tituloLd: "PROJETO ARQUITETÔNICO", numTomos: 1, tomoInicial: 1 },
    rotulo: "LD",
  };
  const p = payloadDoItem({ item, selos, tituloDaSeparatriz: "" }) as Record<string, unknown>;
  assert.equal(typeof p.folhas, "string");
  assert.equal(p.tomo, 0);
});

// ---------------------------------------------------------------------------
// O defeito: mudar um parâmetro depois de gerar
// ---------------------------------------------------------------------------

test("gerou e nada mudou: aplicado", () => {
  const item = itemCapa(PARAMS_CAPA);
  const gerado = payloadDoItem({ item, selos, tituloDaSeparatriz: "" });
  const agora = payloadDoItem({ item, selos, tituloDaSeparatriz: "" });
  assert.equal(estadoDoArtefato({ payload: gerado }, agora), "aplicado");
});

test("MUDOU O VOLUME depois de gerar: pendente, nao 'gerado'", () => {
  const gerado = payloadDoItem({ item: itemCapa(PARAMS_CAPA), selos, tituloDaSeparatriz: "" });
  const agora = payloadDoItem({
    item: itemCapa({ ...PARAMS_CAPA, volume: "VI" }),
    selos,
    tituloDaSeparatriz: "",
  });
  assert.equal(estadoDoArtefato({ payload: gerado }, agora), "pendente");
});

test("MUDOU A PREFEITURA depois de gerar: pendente — o erro que originou o produto", () => {
  const gerado = payloadDoItem({ item: itemCapa(PARAMS_CAPA), selos, tituloDaSeparatriz: "" });
  const agora = payloadDoItem({
    item: itemCapa({ ...PARAMS_CAPA, templateId: "ararangua" }),
    selos,
    tituloDaSeparatriz: "",
  });
  assert.equal(estadoDoArtefato({ payload: gerado }, agora), "pendente");
});

test("MUDOU A DATA depois de gerar: pendente", () => {
  const gerado = payloadDoItem({ item: itemCapa(PARAMS_CAPA), selos, tituloDaSeparatriz: "" });
  const agora = payloadDoItem({
    item: itemCapa({ ...PARAMS_CAPA, mes: "12" }),
    selos,
    tituloDaSeparatriz: "",
  });
  assert.equal(estadoDoArtefato({ payload: gerado }, agora), "pendente");
});

test("resultado antigo sem payload guardado: pendente, porque não dá para provar que está em dia", () => {
  const agora = payloadDoItem({ item: itemCapa(PARAMS_CAPA), selos, tituloDaSeparatriz: "" });
  assert.equal(estadoDoArtefato({ payload: undefined }, agora), "pendente");
});

test("nunca gerado: proposta", () => {
  const agora = payloadDoItem({ item: itemCapa(PARAMS_CAPA), selos, tituloDaSeparatriz: "" });
  assert.equal(estadoDoArtefato(undefined, agora), "proposta");
});

console.log(`\n${passed} testes do estado pendente do plano OK`);
