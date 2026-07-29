/**
 * Teste da regra do TETO MENSAL de gasto de IA.
 *
 * O que se testa aqui é a política, não o banco: quando o teto existe, quando
 * ele não existe, e o que o usuário lê ao ser recusado. A soma em si é uma
 * agregação do Prisma — provada no navegador, com a rota devolvendo 402.
 *
 *   node scripts/test-ai-budget.ts   (== npm run test:ai-budget)
 */
import assert from "node:assert/strict";

import { getMonthlyBudgetUsd, mensagemDeTetoEstourado } from "../lib/ai-budget-policy.ts";

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

test("sem variável de ambiente, NÃO há teto", () => {
  delete process.env.NEXODOC_MONTHLY_BUDGET_USD;
  // Ligar um limite por padrão quebraria ambientes existentes sem aviso, e um
  // número inventado não seria mais seguro que nenhum: é decisão comercial.
  assert.equal(getMonthlyBudgetUsd(), null);
});

test("valor inválido ou zero também não vira teto", () => {
  for (const v of ["", "abc", "0", "-5"]) {
    process.env.NEXODOC_MONTHLY_BUDGET_USD = v;
    assert.equal(getMonthlyBudgetUsd(), null, `"${v}" não deveria virar teto`);
  }
});

test("valor positivo vira teto", () => {
  process.env.NEXODOC_MONTHLY_BUDGET_USD = "250.5";
  assert.equal(getMonthlyBudgetUsd(), 250.5);
});

test("a recusa diz os NÚMEROS, não só 'não'", () => {
  const msg = mensagemDeTetoEstourado({
    ativo: true,
    gastoUsd: 251.239,
    tetoUsd: 250,
    estourou: true,
  });
  // Quem é barrado precisa saber quanto gastou e qual era o limite — senão a
  // única saída é abrir um chamado para descobrir.
  assert.match(msg, /251\.24/);
  assert.match(msg, /250\.00/);
});

delete process.env.NEXODOC_MONTHLY_BUDGET_USD;
console.log(`\n${passed} teste(s) de teto OK`);
