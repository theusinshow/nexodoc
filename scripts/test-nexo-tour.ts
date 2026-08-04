/**
 * Geometria do balão do tour: nunca fora da janela, nunca em cima do alvo.
 * Puro, node cru.
 *
 *   node scripts/test-nexo-tour.ts   (== npm run test:nexo:tour)
 */
import assert from "node:assert/strict";

import {
  posicaoDoBalao,
  FOLGA,
  MARGEM,
  type Retangulo,
} from "../modules/nexo/lib/posicao-do-balao.ts";
import { PASSOS_DO_TOUR } from "../modules/nexo/lib/passos-do-tour.ts";

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

const JANELA = { largura: 1440, altura: 900 };
const BALAO = { largura: 320, altura: 160 };

function sobrepoe(a: Retangulo, b: Retangulo): boolean {
  return (
    a.x < b.x + b.largura && a.x + a.largura > b.x && a.y < b.y + b.altura && a.y + a.altura > b.y
  );
}

test("abaixo do alvo, centrado nele", () => {
  const alvo = { x: 600, y: 300, largura: 200, altura: 40 };
  const pos = posicaoDoBalao(alvo, BALAO, JANELA, "abaixo");
  assert.equal(pos.lado, "abaixo");
  assert.equal(pos.y, alvo.y + alvo.altura + FOLGA);
  assert.equal(pos.x, 600 + 100 - 160);
});

test("sem espaço embaixo, vira para cima sozinho", () => {
  const alvo = { x: 600, y: 800, largura: 200, altura: 40 };
  const pos = posicaoDoBalao(alvo, BALAO, JANELA, "abaixo");
  assert.equal(pos.lado, "acima");
  assert.equal(pos.y, 800 - FOLGA - BALAO.altura);
});

test("alvo colado na borda esquerda não empurra o balão para fora", () => {
  const alvo = { x: 4, y: 300, largura: 40, altura: 40 };
  const pos = posicaoDoBalao(alvo, BALAO, JANELA, "abaixo");
  assert.ok(pos.x >= MARGEM, `x=${pos.x}`);
});

test("alvo colado na borda direita idem", () => {
  const alvo = { x: 1400, y: 300, largura: 40, altura: 40 };
  const pos = posicaoDoBalao(alvo, BALAO, JANELA, "abaixo");
  assert.ok(pos.x + BALAO.largura <= JANELA.largura - MARGEM, `x=${pos.x}`);
});

test("o balão nunca cobre o alvo", () => {
  const alvos: Retangulo[] = [
    { x: 600, y: 300, largura: 200, altura: 40 },
    { x: 4, y: 10, largura: 40, altura: 40 },
    { x: 1200, y: 820, largura: 200, altura: 60 },
    { x: 20, y: 400, largura: 300, altura: 300 },
  ];
  for (const alvo of alvos) {
    const pos = posicaoDoBalao(alvo, BALAO, JANELA, "abaixo");
    if (pos.lado === "centro") continue;
    assert.ok(
      !sobrepoe({ x: pos.x, y: pos.y, largura: BALAO.largura, altura: BALAO.altura }, alvo),
      `balão sobre o alvo em ${JSON.stringify(alvo)} (lado ${pos.lado})`,
    );
  }
});

test("alvo que ocupa a janela inteira manda o balão para o centro", () => {
  const alvo = { x: 0, y: 0, largura: 1440, altura: 900 };
  const pos = posicaoDoBalao(alvo, BALAO, JANELA, "abaixo");
  assert.equal(pos.lado, "centro");
  assert.equal(pos.x, (1440 - 320) / 2);
});

test("janela estreita (celular) ainda devolve posição dentro da tela", () => {
  const janela = { largura: 390, altura: 780 };
  const balao = { largura: 300, altura: 150 };
  const pos = posicaoDoBalao({ x: 20, y: 60, largura: 350, altura: 44 }, balao, janela, "abaixo");
  assert.ok(pos.x >= 0 && pos.x + balao.largura <= janela.largura, `x=${pos.x}`);
  assert.ok(pos.y >= 0 && pos.y + balao.altura <= janela.altura, `y=${pos.y}`);
});

// --- O roteiro -------------------------------------------------------------

test("todo passo tem título e corpo", () => {
  for (const passo of PASSOS_DO_TOUR) {
    assert.ok(passo.titulo.length > 0, `${passo.id} sem título`);
    assert.ok(passo.corpo.length > 0, `${passo.id} sem corpo`);
  }
});

test("os ids não se repetem", () => {
  const ids = PASSOS_DO_TOUR.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

// O tour é o primeiro contato de quem nunca abriu o produto: o texto não pode
// falar a língua de quem já conhece a casa.
test("nenhum passo usa emoji (DESIGN.md §11)", () => {
  for (const passo of PASSOS_DO_TOUR) {
    const texto = `${passo.titulo} ${passo.corpo}`;
    assert.ok(!/\p{Extended_Pictographic}/u.test(texto), `${passo.id} tem emoji`);
  }
});

test("cobre os dois carros-chefe: montagem e auditoria", () => {
  const ids = PASSOS_DO_TOUR.map((p) => p.id).join(" ");
  assert.ok(/volume|selo|mapa/.test(ids), "faltou a montagem");
  assert.ok(/auditoria|veredito|documento/.test(ids), "faltou a auditoria");
});

console.log(`\n${passed} testes ok`);
