/**
 * A CONTESTAÇÃO PRESERVA O QUE A VALIDAÇÃO ALEGOU.
 *
 * Os motivos vêm do teste real de 18/08/2026, em que a validação diagnosticou
 * três falsos positivos nossos e os três vereditos eram descartados.
 *
 *   node scripts/test-contestacao-de-regra.ts  (== npm run test:contestacao)
 */
import assert from "node:assert/strict";

import { linhaDeLog, registrarContestacao } from "../lib/contestacao-de-regra.ts";

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

const achado = (p: Record<string, unknown>) => p as never;

test("o caso real: guarda o motivo que diagnosticou o falso positivo", () => {
  const c = registrarContestacao(
    achado({
      id: "INC-010",
      tipo: "Nome de obra/unidade divergente no mesmo documento",
      pagina: "215",
      evidencia: "“UBS – Unidade Básica de Saúde Vila Manaus Porte 1, em Criciúma, SC”",
    }),
    "Não há nome de outra obra, município, órgão ou endereço.",
  );
  assert.equal(c.achado, "INC-010");
  assert.match(c.motivo, /Não há nome de outra obra/);
  assert.match(c.evidencia, /Vila Manaus/);
});

test("motivo ausente não vira string vazia", () => {
  // Uma contestação sem motivo ainda é informação — perder o registro seria
  // voltar ao silêncio que este módulo existe para acabar.
  const c = registrarContestacao(achado({ id: "INC-001", tipo: "X", pagina: "1" }), undefined);
  assert.ok(c.motivo.length > 10);
  assert.match(c.motivo, /sem declarar motivo/);
});

test("quebra de linha da evidência é achatada", () => {
  const c = registrarContestacao(
    achado({ id: "INC-002", tipo: "Y", pagina: "9", evidencia: "linha um\n\n  linha dois" }),
    "motivo",
  );
  assert.equal(c.evidencia, "linha um linha dois");
});

test("campos longos são cortados: parecer inteiro cabe em 4 MB", () => {
  const c = registrarContestacao(
    achado({ id: "I", tipo: "T", pagina: "1", evidencia: "e".repeat(5000) }),
    "m".repeat(5000),
  );
  assert.ok(c.motivo.length <= 220);
  assert.ok(c.evidencia.length <= 240);
});

test("a linha de log traz achado, regra, página e motivo", () => {
  const linha = linhaDeLog({
    achado: "INC-006",
    tipo: "Área total construída divergente no mesmo documento",
    pagina: "99, 100",
    motivo: "O candidato compara área construída com quantidade de pessoas.",
    evidencia: "",
  });
  assert.match(linha, /INC-006/);
  assert.match(linha, /Área total construída/);
  assert.match(linha, /99, 100/);
  assert.match(linha, /quantidade de pessoas/);
});

console.log(`\n${passed} teste(s) de contestação de regra OK`);
