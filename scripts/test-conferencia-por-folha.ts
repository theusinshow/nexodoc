/**
 * DA CONFERÊNCIA AGREGADA PARA A FOLHA — sem navegador.
 *
 *   node scripts/test-conferencia-por-folha.ts   (== npm run test:conferencia-folha)
 */
import assert from "node:assert/strict";

import {
  contagemDaConferencia,
  divergenciasPorFolha,
} from "../modules/nexo/lib/conferencia-por-folha.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${nome}`);
}

test("achado sem folhas nao marca no nenhum", () => {
  const i = divergenciasPorFolha([
    { severidade: "aviso", campo: "sequencia", mensagem: "Folha 3 faltando." },
  ]);
  assert.equal(i.size, 0);
});

test("a folha herda a severidade do achado que a alcanca", () => {
  const i = divergenciasPorFolha([
    {
      severidade: "critico",
      campo: "codigo",
      mensagem: "Códigos divergentes.",
      folhas: ["a.pdf"],
    },
  ]);
  assert.equal(i.get("a.pdf")?.severidade, "critico");
});

test("A PIOR VENCE, mesmo quando o aviso vem primeiro", () => {
  const i = divergenciasPorFolha([
    {
      severidade: "aviso",
      campo: "revisao",
      mensagem: "Revisões divergentes.",
      folhas: ["a.pdf"],
    },
    {
      severidade: "critico",
      campo: "codigo",
      mensagem: "Códigos divergentes.",
      folhas: ["a.pdf"],
    },
  ]);
  assert.equal(
    i.get("a.pdf")?.severidade,
    "critico",
    "rebaixar aqui esconderia o problema",
  );
});

test("e a folha guarda TODOS os motivos, nao so o pior", () => {
  const i = divergenciasPorFolha([
    {
      severidade: "aviso",
      campo: "revisao",
      mensagem: "Revisões divergentes.",
      folhas: ["a.pdf"],
    },
    {
      severidade: "critico",
      campo: "codigo",
      mensagem: "Códigos divergentes.",
      folhas: ["a.pdf"],
    },
  ]);
  assert.deepEqual(i.get("a.pdf")?.motivos, [
    "Revisões divergentes.",
    "Códigos divergentes.",
  ]);
});

test("severidade desconhecida cai em info, e nao vira critico por acidente", () => {
  const i = divergenciasPorFolha([
    {
      severidade: "seja-la-o-que-for",
      campo: "x",
      mensagem: "?",
      folhas: ["a.pdf"],
    },
  ]);
  assert.equal(i.get("a.pdf")?.severidade, "info");
});

test("a contagem conta FOLHAS, e nao achados", () => {
  const i = divergenciasPorFolha([
    {
      severidade: "critico",
      campo: "codigo",
      mensagem: "x",
      folhas: ["a.pdf", "b.pdf"],
    },
    { severidade: "critico", campo: "obra", mensagem: "y", folhas: ["a.pdf"] },
    { severidade: "aviso", campo: "revisao", mensagem: "z", folhas: ["c.pdf"] },
  ]);
  assert.deepEqual(contagemDaConferencia(i), { critico: 2, aviso: 1, info: 0 });
});

test("conjunto limpo nao produz indice nenhum", () => {
  assert.equal(divergenciasPorFolha([]).size, 0);
  assert.deepEqual(contagemDaConferencia(new Map()), {
    critico: 0,
    aviso: 0,
    info: 0,
  });
});

console.log(`\n${passed} ok`);
