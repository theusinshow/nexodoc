/**
 * OS CONTROLES DA PLATAFORMA — escada, guardas e o freio. Puro → node cru.
 *
 *   node scripts/test-controles.ts   (== npm run test:controles)
 */
import assert from "node:assert/strict";

import {
  CONTROLES,
  definicaoDoControle,
  escreverFreio,
  lerFreio,
  resolverControle,
  validarValorDoControle,
} from "../lib/controles-da-plataforma.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

const teto = definicaoDoControle("teto.mensal.usd")!;
const blocos = definicaoDoControle("limites.blocosPorArquivo")!;

console.log("controles da plataforma\n");

/* ───────────────────────────── a escada ────────────────────────────────── */

test("sem banco e sem ambiente, o controle não declara nada", () => {
  /*
   * `null` aqui NÃO é "desligado" para os limites de leitura: é "não declarado",
   * e quem decide é o motor — cujo padrão depende do nível da análise (Profundo
   * lê 24 blocos, Padrão lê 8). Um número de fábrica nesta tabela faria o Padrão
   * passar a ler 24 sem ninguém pedir.
   */
  assert.deepEqual(resolverControle(blocos, undefined, undefined), {
    valor: null,
    origem: "padrao",
  });
});

test("o ambiente vence o padrão", () => {
  assert.deepEqual(resolverControle(blocos, undefined, "40"), { valor: 40, origem: "ambiente" });
});

test("o banco vence o ambiente", () => {
  assert.deepEqual(resolverControle(blocos, 12, "40"), { valor: 12, origem: "banco" });
});

test("NULO NO BANCO é decisão, não ausência — e vence o ambiente", () => {
  /*
   * O administrador dizendo "não quero teto" tem que vencer a variável que
   * alguém deixou no painel do provedor meses atrás. Se `null` caísse para o
   * ambiente, tirar o teto pela tela seria impossível.
   */
  assert.deepEqual(resolverControle(teto, null, "500"), { valor: null, origem: "banco" });
});

test("variável ilegível cai para o padrão em vez de estourar", () => {
  // O ambiente é digitado no painel do provedor, sem validação. Um deploy que
  // morre por um espaço a mais é pior que um valor de fábrica.
  assert.deepEqual(resolverControle(blocos, undefined, "  "), { valor: null, origem: "padrao" });
  assert.deepEqual(resolverControle(blocos, undefined, "vinte"), { valor: null, origem: "padrao" });
  assert.deepEqual(resolverControle(blocos, undefined, "0"), { valor: null, origem: "padrao" });
});

/* ───────────────────────────── as guardas ──────────────────────────────── */

test("vazio DESLIGA — é como se tira um teto sem deploy", () => {
  assert.deepEqual(validarValorDoControle("teto.mensal.usd", ""), { ok: true, valor: null });
  assert.deepEqual(validarValorDoControle("teto.mensal.usd", null), { ok: true, valor: null });
});

test("zero NÃO desliga: é um número, e um teto de zero recusa todo trabalho", () => {
  const v = validarValorDoControle("teto.mensal.usd", 0);
  assert.equal(v.ok, false);
});

test("acima do teto da faixa é recusado, com a faixa na mensagem", () => {
  const v = validarValorDoControle("vazao.global", 999);
  assert.equal(v.ok, false);
  if (v.ok) return;
  assert.match(v.motivo, /1 a 50/);
});

test("abaixo do piso é recusado", () => {
  assert.equal(validarValorDoControle("limites.saidaProfundo", 100).ok, false);
});

test("vírgula decimal é aceita — o teclado é brasileiro", () => {
  assert.deepEqual(validarValorDoControle("teto.mensal.usd", "99,5"), { ok: true, valor: 99.5 });
});

test("texto não vira número", () => {
  assert.equal(validarValorDoControle("teto.mensal.usd", "muito").ok, false);
});

test("controle desconhecido é recusado, não ignorado", () => {
  assert.equal(validarValorDoControle("teto.inventado", 10).ok, false);
});

test("todo controle tem faixa coerente e um padrão dentro dela", () => {
  for (const controle of CONTROLES) {
    assert.ok(controle.minimo < controle.maximo, controle.chave);
    if (controle.padrao !== null) {
      assert.ok(
        controle.padrao >= controle.minimo && controle.padrao <= controle.maximo,
        `${controle.chave}: padrão ${controle.padrao} fora da faixa`,
      );
    }
  }
});

/* ──────────────────────── o freio do cadastro ──────────────────────────── */

test("variável AUSENTE = entra na PROSUL", () => {
  assert.deepEqual(lerFreio(undefined), { estado: "prosul", organizationId: "org-prosul" });
});

test("variável definida e VAZIA = exige convite", () => {
  /*
   * A distinção que um booleano perderia, e que é o freio inteiro: definida e
   * vazia desliga o cadastro automático sem precisar de deploy de código.
   */
  assert.deepEqual(lerFreio(""), { estado: "convite", organizationId: null });
  assert.deepEqual(lerFreio("   "), { estado: "convite", organizationId: null });
});

test("variável com outro id = outro escritório", () => {
  assert.deepEqual(lerFreio("org-outra"), { estado: "outra", organizationId: "org-outra" });
});

test("o que a tela escolhe volta a ser o que a variável significava", () => {
  assert.equal(escreverFreio("prosul"), "org-prosul");
  assert.equal(escreverFreio("convite"), "");
  assert.equal(escreverFreio("outra", "org-x"), "org-x");
});

test("\"outra\" sem id NÃO vira PROSUL em silêncio", () => {
  // Viraria o oposto do que quem escolheu "outro escritório" pediu.
  assert.equal(escreverFreio("outra", "  "), null);
});

test("ida e volta preserva os três estados", () => {
  for (const estado of ["prosul", "convite", "outra"] as const) {
    const escrito = escreverFreio(estado, "org-x");
    assert.equal(lerFreio(escrito).estado, estado);
  }
});

console.log(`\n${passed} passaram`);
