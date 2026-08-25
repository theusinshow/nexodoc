/**
 * O ACERVO VIRA FRASE ÚTIL — OU DIZ QUE NÃO TEM NADA.
 *
 * A parte que fala com o banco é fina de propósito; o que decide o TEXTO que o
 * modelo recebe é puro, e é o que se testa aqui.
 *
 * A ferramenta entrega FATOS. Concluir que um defeito se repete é trabalho do
 * modelo, e ele tem `ler_achado` e `buscar_no_memorial` para sustentar a
 * conclusão — por isso um dos testes proíbe a ferramenta de já afirmar isso.
 *
 *   node scripts/test-chat-historico.ts  (== npm run test:chat:historico)
 */
import assert from "node:assert/strict";

import { redigirHistorico } from "../server/audit/chat/historico.ts";

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

test("sem obra e sem parecer anterior, diz que nao ha historico", () => {
  const saida = redigirHistorico({ anteriores: [], aprendizados: [] });
  assert.ok(/n[aã]o h[aá]|primeira/i.test(saida), saida);
  // Nao pode inventar um historico vazio que pareca historico.
  assert.ok(!/revis[aã]o anterior apontou/i.test(saida), saida);
});

test("lista os pareceres anteriores do mais novo para o mais velho", () => {
  const saida = redigirHistorico({
    anteriores: [
      {
        auditId: "b",
        quando: "2026-08-20",
        veredito: "Reprovado",
        totalAchados: 12,
        criticos: 3,
        arquivo: "m_b.pdf",
      },
      {
        auditId: "a",
        quando: "2026-06-02",
        veredito: "Aprovado com ressalvas",
        totalAchados: 27,
        criticos: 5,
        arquivo: "m_a.pdf",
      },
    ],
    aprendizados: [],
  });
  assert.ok(saida.indexOf("2026-08-20") < saida.indexOf("2026-06-02"), saida);
  assert.ok(/12/.test(saida) && /27/.test(saida), saida);
  assert.ok(/Reprovado/.test(saida), saida);
});

test("os aprendizados ativos entram nomeados", () => {
  const saida = redigirHistorico({
    anteriores: [],
    aprendizados: [
      { title: "Clausula 3 do template", content: "Gera 11 achados em todo projeto." },
    ],
  });
  assert.ok(/Clausula 3/.test(saida), saida);
  assert.ok(/11 achados/.test(saida), saida);
});

test("nao promete comparacao que a ferramenta nao faz", () => {
  const saida = redigirHistorico({
    anteriores: [
      {
        auditId: "a",
        quando: "2026-06-02",
        veredito: "Reprovado",
        totalAchados: 27,
        criticos: 5,
        arquivo: "m.pdf",
      },
    ],
    aprendizados: [],
  });
  assert.ok(!/se repete|continua aqui/i.test(saida), saida);
});

console.log(`\n${passed} teste(s) de historico da obra OK`);
