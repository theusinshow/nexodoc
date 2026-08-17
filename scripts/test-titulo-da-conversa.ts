/**
 * O TÍTULO DA CONVERSA na barra lateral.
 *
 * "Hoje o histórico fica totalmente apagado" (Matheus, 17/08/2026): numa
 * conversa só de memorial não há carimbo, o título caía na primeira mensagem, e
 * a lista virava uma pilha de "Anexei o memorial — ..." indistinguíveis.
 *
 *   node scripts/test-titulo-da-conversa.ts   (== npm run test:nexo:titulo-conversa)
 */
import assert from "node:assert/strict";

import { tituloDaConversa } from "../modules/nexo/lib/titulo-da-conversa.ts";

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

const IDENTIDADE = {
  codigo: "084_25",
  orgao: "Prefeitura Municipal de Criciúma",
  obra: "Reforma e Adequação da Emeb Rubens de Arruda Ramos",
};

test("o centro de custo vence tudo", () => {
  assert.equal(
    tituloDaConversa({
      atual: "Nova conversa",
      primeiraFrase: "Anexei o memorial — 084_25_md_geral_a.pdf",
      obraDosSelos: "Centro Comunitário Primeira Linha",
      identidade: IDENTIDADE,
    }),
    "084_25-CRICIUMA",
  );
});

test("conversa só de memorial: sai do dossiê, não da primeira frase", () => {
  // O caso que motivou a mudança: sem carimbo, o título era a frase digitada.
  assert.equal(
    tituloDaConversa({
      atual: "Nova conversa",
      primeiraFrase: "Anexei o memorial — 084_25_md_geral_a.pdf",
      identidade: IDENTIDADE,
    }),
    "084_25-CRICIUMA",
  );
});

test("sem prefeitura, o município serve", () => {
  assert.equal(
    tituloDaConversa({
      atual: "Nova conversa",
      identidade: { codigo: "063_26", municipio: "Içara" },
    }),
    "063_26-ICARA",
  );
});

test("meio centro de custo cai para a obra", () => {
  // `084_25-` ordenaria pior que o nome da obra. Ver `centroDeCustoDaAuditoria`.
  assert.equal(
    tituloDaConversa({
      atual: "Nova conversa",
      identidade: { codigo: "084_25", obra: "Reforma da Emeb" },
    }),
    "Reforma da Emeb",
  );
});

test("sem identidade, a obra do carimbo continua valendo", () => {
  assert.equal(
    tituloDaConversa({
      atual: "Nova conversa",
      primeiraFrase: "monta o volume",
      obraDosSelos: "Centro Comunitário Primeira Linha",
    }),
    "Centro Comunitário Primeira Linha",
  );
});

test("sem nada além da frase, o comportamento antigo permanece", () => {
  assert.equal(
    tituloDaConversa({ atual: "Nova conversa", primeiraFrase: "monta a LD de elétrica" }),
    "monta a LD de elétrica",
  );
});

test("obra longa é encurtada, e a reticência não estoura o teto", () => {
  const longa = "A".repeat(120);
  const t = tituloDaConversa({ atual: "x", obraDosSelos: longa });
  assert.ok(t.length <= 60, `título de ${t.length} chars`);
  assert.ok(t.endsWith("…"));
});

test("frase longa é encurtada", () => {
  const t = tituloDaConversa({ atual: "x", primeiraFrase: "B".repeat(120) });
  assert.ok(t.length <= 48, `título de ${t.length} chars`);
});

test("sem fonte nenhuma, mantém o que já estava", () => {
  assert.equal(tituloDaConversa({ atual: "Conversa de ontem" }), "Conversa de ontem");
  assert.equal(tituloDaConversa({ atual: "" }), "Nova conversa");
});

test("campos vazios não viram título vazio", () => {
  assert.equal(
    tituloDaConversa({
      atual: "Nova conversa",
      primeiraFrase: "   ",
      obraDosSelos: "  ",
      identidade: { codigo: "", orgao: "", obra: "" },
    }),
    "Nova conversa",
  );
});

console.log(`\n${passed} teste(s) de título da conversa OK`);
