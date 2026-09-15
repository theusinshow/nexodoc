/**
 * Teste da LEITURA DE SELO QUE VOLTA VAZIA.
 *
 * Em 15/09/2026 a jornada v2 soltou uma prancha cujo carimbo não tem texto. O
 * modelo respondeu — JSON válido, todos os campos nulos — e a folha passou por
 * LIDA: o chip mostrava um "lido" em branco e a conversa não dizia nada. Para
 * quem usa o selo, uma leitura sem nenhum campo é uma folha não lida.
 *
 *   node scripts/test-leitura-do-selo-vazia.ts
 */
import assert from "node:assert/strict";

import {
  estadoDoAnexo,
  leituraDoSeloVazia,
} from "../modules/nexo/lib/estado-do-anexo.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

const vazia = {
  disciplina: null,
  folha: null,
  total: null,
  numeroFolha: null,
  arquivo: null,
  conteudo: null,
  cliente: null,
  secretaria: null,
  obra: null,
  fase: null,
  tituloSecao: null,
  data: null,
  logoOrgao: null,
};

test("todos os campos nulos é leitura vazia", () => {
  assert.equal(leituraDoSeloVazia(vazia), true);
});

test("texto em branco também não conta como lido", () => {
  assert.equal(
    leituraDoSeloVazia({ ...vazia, arquivo: "  ", conteudo: "" }),
    true,
  );
});

test("qualquer campo que identifica a folha basta", () => {
  assert.equal(
    leituraDoSeloVazia({ ...vazia, arquivo: "990_26_est_001_a" }),
    false,
  );
  assert.equal(
    leituraDoSeloVazia({ ...vazia, conteudo: "PLANTA DE FORMAS" }),
    false,
  );
  assert.equal(leituraDoSeloVazia({ ...vazia, numeroFolha: "01/03" }), false);
  assert.equal(leituraDoSeloVazia({ ...vazia, folha: 1 }), false);
  assert.equal(leituraDoSeloVazia({ ...vazia, disciplina: "EST" }), false);
});

/*
 * VAZIA É TODO CAMPO NULO, como diz o desenho (V2) — revisão final da segunda
 * rodada, 15/09/2026. A regra olhava 6 dos 13 campos: um carimbo parcial, com
 * só cliente e data legíveis, virava "não lido", perdia cliente/obra/data e
 * ainda ia para o cache como vazio.
 */
test("carimbo parcial com só cliente e data legíveis conta como lido", () => {
  assert.equal(
    leituraDoSeloVazia({ ...vazia, cliente: "PREFEITURA MUNICIPAL DE CIDADE FICTICIA", data: "09/2026" }),
    false,
  );
});

test("cada um dos 13 campos, sozinho, já faz a leitura valer", () => {
  const textos = ["disciplina", "numeroFolha", "arquivo", "conteudo", "cliente", "secretaria", "obra", "fase", "tituloSecao", "data", "logoOrgao"] as const;
  for (const campo of textos) {
    assert.equal(leituraDoSeloVazia({ ...vazia, [campo]: "X" }), false, campo);
  }
  assert.equal(leituraDoSeloVazia({ ...vazia, folha: 1 }), false, "folha");
  assert.equal(leituraDoSeloVazia({ ...vazia, total: 3 }), false, "total");
});

test("leitura que falhou (null) não é 'vazia': já é tratada como não lida", () => {
  assert.equal(leituraDoSeloVazia(null), false);
});

test("a folha que vira extraction null aparece como selo ilegível no chip", () => {
  const estado = estadoDoAnexo(
    "990_26_est_004_a.pdf",
    [{ fileName: "990_26_est_004_a.pdf", extraction: null }],
    false,
    (d) => d ?? "",
  );
  assert.deepEqual(estado, { tipo: "ilegivel" });
});

console.log(`\n${passed} teste(s) passaram`);
