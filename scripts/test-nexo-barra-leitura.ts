/**
 * Trava a RÉGUA da barra de leitura. Um volume real vai de 5 a 200 folhas, e a
 * barra tem de servir aos dois extremos sem estourar a linha nem sumir.
 *
 *   node scripts/test-nexo-barra-leitura.ts   (== npm run test:nexo:barra)
 */
import assert from "node:assert/strict";

import { densidadeDaBarra } from "../modules/nexo/lib/densidade-da-barra.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack ?? err.message : err);
    process.exitCode = 1;
  }
}

test("lote pequeno: blocos altos e com respiro", () => {
  assert.deepEqual(densidadeDaBarra(5), { alturaPx: 10, gapPx: 4 });
});

test("lote grande: o vão cede, a altura resiste", () => {
  const medio = densidadeDaBarra(120);
  assert.equal(medio.gapPx, 1, "ainda separa folha de folha");
  const grande = densidadeDaBarra(200);
  assert.equal(grande.gapPx, 0, "fita contínua em vez de sub-pixel");
  assert.ok(grande.alturaPx >= 8, "a barra não pode desaparecer");
});

/*
 * A propriedade que importa mais que os números: nada pode voltar a crescer
 * quando o lote cresce, senão um volume grande fica MENOS legível que um médio.
 */
test("nunca engorda quando o lote cresce", () => {
  let anterior = densidadeDaBarra(1);
  for (const total of [5, 12, 13, 40, 41, 90, 91, 200, 500]) {
    const atual = densidadeDaBarra(total);
    assert.ok(
      atual.gapPx <= anterior.gapPx,
      `gap subiu de ${anterior.gapPx} para ${atual.gapPx} em ${total}`,
    );
    assert.ok(
      atual.alturaPx <= anterior.alturaPx,
      `altura subiu de ${anterior.alturaPx} para ${atual.alturaPx} em ${total}`,
    );
    anterior = atual;
  }
});

test("sempre visível: a barra nunca tem altura zero", () => {
  for (const total of [1, 5, 12, 40, 90, 200, 1000]) {
    assert.ok(densidadeDaBarra(total).alturaPx > 0, `altura zero em ${total}`);
  }
});

/*
 * Até 150 folhas dá para distinguir uma da outra, e o vão existe para isso.
 * Acima disso ele zera de propósito: a barra vira fita contínua em vez de
 * sumir no sub-pixel. Ver o comentário de `densidade-da-barra.ts`.
 */
test("o vão separa enquanto separar for possível", () => {
  for (const total of [1, 12, 40, 90, 150]) {
    assert.ok(densidadeDaBarra(total).gapPx >= 1, `sem separação em ${total}`);
  }
  assert.equal(densidadeDaBarra(151).gapPx, 0, "acima do teto, fita contínua");
});

/*
 * A barra é desenhada com `repeat(total, 1fr)` + gap. Num lote grande o vão
 * total não pode comer a largura toda: com 200 folhas e 1px, são 199px de vão,
 * que cabe numa conversa de ~736px (max-w-[46rem]).
 */
test("cada folha sobra com pixel de verdade, em qualquer lote", () => {
  const LARGURA_DA_CONVERSA = 736; // max-w-[46rem] da conversa
  for (const total of [5, 40, 90, 150, 200, 400, 1000]) {
    const { gapPx } = densidadeDaBarra(total);
    const vao = (total - 1) * gapPx;
    const porFolha = (LARGURA_DA_CONVERSA - vao) / total;
    assert.ok(
      porFolha >= 0.5,
      `com ${total} folhas sobra ${porFolha.toFixed(2)}px por folha — sub-pixel`,
    );
  }
});

console.log(`\n${passed} teste(s) ok.`);
