/**
 * Geometria do balão do tour: nunca fora da janela, nunca em cima do alvo.
 * Puro, node cru.
 *
 *   node scripts/test-nexo-tour.ts   (== npm run test:nexo:tour)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  posicaoDoBalao,
  FOLGA,
  MARGEM,
  type Retangulo,
} from "../modules/nexo/lib/posicao-do-balao.ts";
import { PASSOS_DO_TOUR } from "../modules/nexo/lib/passos-do-tour.ts";
import { PASSOS_DO_TOUR_DO_RESULTADO } from "../modules/nexo/lib/passos-do-tour-do-resultado.ts";
import { PASSOS_DO_TOUR_DO_VOLUME } from "../modules/nexo/lib/passos-do-tour-do-volume.ts";
import { pontosDoHolofote, recorteDoAlvo, recorteDoHolofote, RESPIRO } from "../modules/nexo/lib/holofote.ts";
import { ausentesPrevistos, capitulosDoRoteiro, cliqueQueOPassoPressupoe, ondeEsta, semOsAusentes } from "../modules/nexo/lib/capitulos-do-tour.ts";

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

const ROTEIROS = { nexo: PASSOS_DO_TOUR, resultado: PASSOS_DO_TOUR_DO_RESULTADO, volume: PASSOS_DO_TOUR_DO_VOLUME };
const TODOS_OS_PASSOS = [...PASSOS_DO_TOUR, ...PASSOS_DO_TOUR_DO_RESULTADO, ...PASSOS_DO_TOUR_DO_VOLUME];

test("todo passo tem título e corpo", () => {
  for (const passo of TODOS_OS_PASSOS) {
    assert.ok(passo.titulo.length > 0, `${passo.id} sem título`);
    assert.ok(passo.corpo.length > 0, `${passo.id} sem corpo`);
  }
});

test("os ids não se repetem dentro de um roteiro", () => {
  for (const [nome, passos] of Object.entries(ROTEIROS)) {
    const ids = passos.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, nome);
  }
});

// O tour é o primeiro contato de quem nunca abriu o produto: o texto não pode
// falar a língua de quem já conhece a casa.
test("nenhum passo usa emoji (DESIGN.md §11)", () => {
  for (const passo of TODOS_OS_PASSOS) {
    const texto = `${passo.titulo} ${passo.corpo}`;
    assert.ok(!/\p{Extended_Pictographic}/u.test(texto), `${passo.id} tem emoji`);
  }
});

test("cobre os dois carros-chefe: montagem e auditoria", () => {
  const ids = PASSOS_DO_TOUR.map((p) => p.id).join(" ");
  assert.ok(/volume|selo|mapa/.test(ids), "faltou a montagem");
  assert.ok(/auditoria|veredito|documento/.test(ids), "faltou a auditoria");
});

// Um passo que aponta para um elemento que não existe mais é um balão no
// centro falando de algo invisível (07/10/2026: `abrir-parecer` só vivia no
// AuditCanvas, que nenhuma tela monta). Todo alvo tem de estar no código vivo.
test("todo alvo existe numa tela viva", () => {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const fontes: string[] = [];
  const andar = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) andar(f);
      else if (f.endsWith(".tsx") && !f.endsWith("AuditCanvas.tsx")) fontes.push(fs.readFileSync(f, "utf8"));
    }
  };
  andar(path.join(raiz, "modules/nexo/components"));
  andar(path.join(raiz, "components/telas"));
  andar(path.join(raiz, "components/achado"));
  const todo = fontes.join("\n");
  // As leituras do trilho nascem de um molde (`vista-${n.id}`): vale o molde E o id na lista.
  const daLeitura = (nome: string) => nome.startsWith("vista-") && todo.includes("`vista-${n.id}`") && todo.includes(`id: "${nome.slice(6)}"`);
  for (const passo of TODOS_OS_PASSOS) {
    for (const seletor of [passo.alvo, passo.clicarAntes, passo.soSeExistir, passo.revelar]) {
      const nome = seletor && /data-tour="([^"]+)"/.exec(seletor)?.[1];
      if (nome) assert.ok(todo.includes(`data-tour="${nome}"`) || todo.includes(`"${nome}"`) || daLeitura(nome), `${passo.id}: alvo ${nome} não existe`);
    }
  }
});

// O tutorial do resultado roda sobre um parecer DE VERDADE: ele só troca de
// leitura. Um clique de passo num botão que grava (encerrar, atribuir, votar)
// mexeria no trabalho da pessoa sem ela pedir.
test("o tutorial do resultado só clica para trocar de leitura", () => {
  for (const passo of PASSOS_DO_TOUR_DO_RESULTADO) {
    if (!passo.clicarAntes) continue;
    assert.match(passo.clicarAntes, /data-tour="(vista-[a-z]+|chip-no-documento)"/, `${passo.id} clica em ${passo.clicarAntes}`);
  }
});

// O volume aberto é real: Montar gasta e grava, Baixar baixa, Dividir muda o
// plano. O passo a passo só pode trocar para a vista Volume.
test("o tutorial do volume só clica na aba Volume", () => {
  for (const passo of PASSOS_DO_TOUR_DO_VOLUME) {
    if (!passo.clicarAntes) continue;
    assert.equal(passo.clicarAntes, '[data-tour="aba-volume"]', `${passo.id} clica em ${passo.clicarAntes}`);
  }
});

test("o tutorial do volume explica os dois botões da entrega e o teto", () => {
  const ids = PASSOS_DO_TOUR_DO_VOLUME.map((p) => p.id);
  for (const id of ["acao", "editaveis", "volumes", "teto"]) assert.ok(ids.includes(id), id);
  assert.deepEqual(capitulosDoRoteiro(PASSOS_DO_TOUR_DO_VOLUME).map((c) => c.nome), ["O mapa", "A entrega"]);
});

test("o tutorial do resultado passa por cada botão de encerrar", () => {
  const encerrar = PASSOS_DO_TOUR_DO_RESULTADO.find((p) => p.id === "encerrar");
  assert.ok(encerrar, "faltou o passo de encerrar");
  for (const rotulo of ["Marcar corrigido", "Decisão técnica", "Falso positivo"]) assert.ok(encerrar.corpo.includes(rotulo), rotulo);
});

// --- O holofote ------------------------------------------------------------

// A transição de `clip-path` só interpola polígonos com o MESMO número de
// pontos: se a contagem variar, o recorte salta em vez de deslizar.
test("o recorte do holofote tem sempre 13 pontos", () => {
  const casos = [null, { x: 600, y: 300, largura: 200, altura: 40 }, { x: 0, y: 0, largura: 1440, altura: 900 }, { x: 10, y: 10, largura: 2, altura: 2 }];
  for (const alvo of casos) assert.equal(pontosDoHolofote(alvo, JANELA).length, 13, JSON.stringify(alvo));
  assert.match(recorteDoHolofote(null, JANELA), /^polygon\(evenodd, /);
});

test("sem alvo, o recorte fecha num ponto no centro", () => {
  for (const [x, y] of pontosDoHolofote(null, JANELA).slice(5, 12)) assert.deepEqual([x, y], [720, 450]);
});

test("o recorte abraça o alvo com respiro e não sai da janela", () => {
  const r = recorteDoAlvo({ x: 600, y: 300, largura: 200, altura: 40 }, JANELA);
  assert.deepEqual(r, { x: 600 - RESPIRO, y: 300 - RESPIRO, largura: 200 + 2 * RESPIRO, altura: 40 + 2 * RESPIRO });
  for (const [x, y] of pontosDoHolofote({ x: -50, y: -50, largura: 3000, altura: 3000 }, JANELA))
    assert.ok(x >= 0 && x <= 1440 && y >= 0 && y <= 900, `${x},${y}`);
});

// --- Os capítulos ----------------------------------------------------------

test("os capítulos do resultado herdam e somam o roteiro inteiro", () => {
  const caps = capitulosDoRoteiro(PASSOS_DO_TOUR_DO_RESULTADO);
  assert.deepEqual(caps.map((c) => c.nome), ["Resumo", "Trilho", "Achados", "Outras leituras"]);
  assert.equal(caps.reduce((n, c) => n + c.total, 0), PASSOS_DO_TOUR_DO_RESULTADO.length);
});

test("pular capítulo cai no primeiro passo do seguinte; no último, não há para onde", () => {
  const caps = capitulosDoRoteiro(PASSOS_DO_TOUR_DO_RESULTADO);
  const onde = ondeEsta(caps, PASSOS_DO_TOUR_DO_RESULTADO.findIndex((p) => p.id === "busca"));
  assert.equal(onde.capitulo.nome, "Achados");
  assert.equal(onde.passo, 2);
  assert.equal(PASSOS_DO_TOUR_DO_RESULTADO[onde.proximoCapitulo!].id, "relatorio");
  assert.equal(ondeEsta(caps, PASSOS_DO_TOUR_DO_RESULTADO.length - 1).proximoCapitulo, null);
});

test("roteiro sem capítulo é um capítulo só", () => {
  const caps = capitulosDoRoteiro(PASSOS_DO_TOUR);
  assert.equal(caps.length, 1);
  assert.equal(caps[0].total, PASSOS_DO_TOUR.length);
});

// Quem retoma no meio da fila não passou pelo clique em "Achados": o passo
// tem de saber que vista pressupõe, senão aponta para o Resumo.
test("todo passo do resultado sabe que vista pressupõe", () => {
  const busca = PASSOS_DO_TOUR_DO_RESULTADO.findIndex((p) => p.id === "busca");
  assert.equal(cliqueQueOPassoPressupoe(PASSOS_DO_TOUR_DO_RESULTADO, busca), '[data-tour="vista-findings"]');
  PASSOS_DO_TOUR_DO_RESULTADO.forEach((_, i) => assert.ok(cliqueQueOPassoPressupoe(PASSOS_DO_TOUR_DO_RESULTADO, i), `passo ${i}`));
});

// 10/10/2026: o volume sem tomo pesado ia de "O mapa · 6 de 8" a "8 de 8".
test("o passo pulado sai da contagem: sem buraco no 'N de M'", () => {
  const teto = PASSOS_DO_TOUR_DO_VOLUME.findIndex((p) => p.id === "teto");
  const conferencia = PASSOS_DO_TOUR_DO_VOLUME.findIndex((p) => p.id === "conferencia");
  const vis = semOsAusentes(PASSOS_DO_TOUR_DO_VOLUME, new Set([teto]));
  const caps = capitulosDoRoteiro(vis.passos);
  const onde = ondeEsta(caps, vis.indices.indexOf(conferencia));
  assert.equal(onde.capitulo.nome, "O mapa");
  assert.equal(onde.passo, onde.capitulo.total, "a conferência é o último do capítulo");
  assert.equal(onde.passo, teto - caps[0].inicio + 1, "e ocupa o número que o teto ocuparia");
});

test("capítulo cujo primeiro passo saiu passa o nome ao seguinte", () => {
  const doca = PASSOS_DO_TOUR_DO_VOLUME.findIndex((p) => p.id === "doca");
  const vis = semOsAusentes(PASSOS_DO_TOUR_DO_VOLUME, new Set([doca]));
  assert.deepEqual(capitulosDoRoteiro(vis.passos).map((c) => c.nome), ["O mapa", "A entrega"]);
});

test("a previsão de ausentes para na troca de vista", () => {
  const passos = [
    { id: "a", titulo: "a", corpo: "a" },
    { id: "b", titulo: "b", corpo: "b", soSeExistir: "#b" },
    { id: "c", titulo: "c", corpo: "c", clicarAntes: "#vista" },
    { id: "d", titulo: "d", corpo: "d", soSeExistir: "#d" },
  ];
  assert.deepEqual(ausentesPrevistos(passos, 0, () => false), [1], "o d vem depois de trocar de vista: não se prevê");
  assert.deepEqual(ausentesPrevistos(passos, 0, (sel) => sel === "#b"), []);
});

console.log(`\n${passed} testes ok`);
