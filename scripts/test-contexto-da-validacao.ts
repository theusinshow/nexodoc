/**
 * O VALIDADOR PRECISA VER A PÁGINA DO ACHADO.
 *
 * Até 17/08/2026 ele recebia uma AMOSTRA do documento (o recorte de 90k do nível
 * Padrão, cortado em 45k por arquivo) — 8% de um memorial de 547.855 caracteres.
 * Os falsos positivos "Escola Geral" (p. 181) do 084_25 sobreviveram porque a
 * validação nunca viu a página 181. Quem não lê não refuta: carimba.
 *
 *   node scripts/test-contexto-da-validacao.ts   (== npm run test:contexto-validacao)
 */
import assert from "node:assert/strict";

import { buildValidationContext } from "../lib/audit-validation-prompt.ts";
import type { AuditFinding } from "../lib/audit-report.ts";

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

/** 200 páginas; a 181 tem a marca que o teste procura. */
function memorial() {
  const pages = Array.from({ length: 200 }, (_, i) => ({
    page: i + 1,
    text:
      i + 1 === 181
        ? "Ocupacao predominante: Escola Geral - E-1 Grupo E MARCA_181"
        : `Conteudo de enchimento da pagina ${i + 1}. ${"x".repeat(2000)}`,
  }));

  return [
    {
      file: { name: "084_25_md.pdf" },
      fileType: "memorial",
      extracted: {
        pages,
        text: pages.map((p) => p.text).join("\n"),
        pageCount: pages.length,
        charCount: pages.reduce((n, p) => n + p.text.length, 0),
      },
    },
  ];
}

function achado(pagina: string, over: Partial<AuditFinding> = {}): AuditFinding {
  return {
    id: "INC-001",
    prioridade: "Alta",
    pagina,
    capitulo: "x",
    local: "x",
    tipo: "x",
    descricao: "x",
    evidencia: "x",
    conflito: "x",
    sugestao_correcao: "x",
    confianca: "alta",
    ...over,
  } as AuditFinding;
}

test("O CASO REAL: a página 181 entra no contexto", () => {
  const ctx = buildValidationContext(memorial(), [achado("181")]);
  assert.match(ctx, /MARCA_181/, "o validador precisa ver a página que julga");
});

test("sem os achados, a página 181 NÃO entra — era o comportamento antigo", () => {
  /*
   * Prova que o defeito era real: a amostragem de cabeça/meio/cauda de um
   * documento de 200 páginas não alcança a 181.
   */
  const ctx = buildValidationContext(memorial());
  assert.doesNotMatch(ctx, /MARCA_181/);
});

test("as vizinhas entram junto — o trecho atravessa a virada", () => {
  const ctx = buildValidationContext(memorial(), [achado("181")]);
  assert.match(ctx, /PÁGINA 180/);
  assert.match(ctx, /PÁGINA 182/);
});

test("página 1 não gera vizinha zero nem negativa", () => {
  const ctx = buildValidationContext(memorial(), [achado("1")]);
  assert.doesNotMatch(ctx, /PÁGINA 0/);
  assert.doesNotMatch(ctx, /PÁGINA -/);
});

test("achado multipágina traz todas as páginas", () => {
  const ctx = buildValidationContext(memorial(), [achado("25, 181")]);
  assert.match(ctx, /PÁGINA 25/);
  assert.match(ctx, /MARCA_181/);
});

test("achado sem página resolvível cai na amostragem — não devolve vazio", () => {
  // Contexto genérico é pior que o certo, e muito melhor que nenhum.
  const ctx = buildValidationContext(memorial(), [achado("não identificada")]);
  assert.ok(ctx.length > 1000);
  assert.match(ctx, /TEXTO DE CONTEXTO/);
});

test("o cabeçalho DIZ que o recorte é focalizado", () => {
  // Quem lê o prompt (e quem depura) precisa saber qual estratégia rodou.
  const ctx = buildValidationContext(memorial(), [achado("181")]);
  assert.match(ctx, /páginas citadas pelos achados/i);
});

test("respeita o orçamento mesmo com achado em toda página", () => {
  const muitos = Array.from({ length: 200 }, (_, i) => achado(String(i + 1)));
  const ctx = buildValidationContext(memorial(), muitos);
  assert.ok(ctx.length <= 92_000, `contexto de ${ctx.length} chars estourou o orçamento`);
});

console.log(`\n${passed} teste(s) de contexto da validação OK`);
