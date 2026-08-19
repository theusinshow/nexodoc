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

import {
  getMonthlyBudgetUsd,
  isentoDoTeto,
  mensagemDeTetoEstourado,
} from "../lib/ai-budget-policy.ts";

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

/*
 * O ADMIN É ISENTO DO BLOQUEIO — e só do bloqueio.
 *
 * Quem administra é quem testa, reprocessa e demonstra: bater a trave no meio
 * de uma demonstração é pior do que a fatura que o teto protege. Medido no
 * banco real: o mês mais pesado de um usuário comum foi US$ 0,91, e o de quem
 * desenvolve, US$ 19,31 — vinte vezes mais, e nenhuma das duas é uso de
 * engenheiro montando volume.
 *
 * O gasto dele CONTINUA sendo gravado e somado. Isento de bloqueio não é
 * isento de conta: esconder o gasto de quem mais gasta cegaria justamente o
 * número que decide o teto de todo mundo.
 */
test("admin não é barrado, mesmo acima do teto", () => {
  const admins = "yazan@prosul.com, matheus@prosul.com";
  assert.equal(isentoDoTeto("matheus@prosul.com", admins), true);
  assert.equal(isentoDoTeto("MATHEUS@PROSUL.COM", admins), true, "caixa não importa");
  assert.equal(isentoDoTeto("  matheus@prosul.com  ", admins), true, "espaço não importa");
});

test("quem não é admin continua sujeito ao teto", () => {
  const admins = "yazan@prosul.com";
  assert.equal(isentoDoTeto("lais@prosul.com", admins), false);
  assert.equal(isentoDoTeto(null, admins), false);
  assert.equal(isentoDoTeto("", admins), false);
});

test("sem lista de admin, ninguém é isento", () => {
  // O modo de falhar seguro: variável ausente NÃO libera geral.
  assert.equal(isentoDoTeto("qualquer@prosul.com", undefined), false);
  assert.equal(isentoDoTeto("qualquer@prosul.com", ""), false);
  assert.equal(isentoDoTeto("qualquer@prosul.com", "   "), false);
});

test("e-mail parecido não passa por engano", () => {
  const admins = "yazan@prosul.com";
  assert.equal(isentoDoTeto("yazan@prosul.com.br", admins), false);
  assert.equal(isentoDoTeto("nao-yazan@prosul.com", admins), false);
});

delete process.env.NEXODOC_MONTHLY_BUDGET_USD;
console.log(`\n${passed} teste(s) de teto OK`);
