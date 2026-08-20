/**
 * A ENTREGA DO VOLUME ACONTECE ANTES DA CONFERÊNCIA.
 *
 * O defeito que este teste tranca, medido em 20/08/2026 com o volume 10 de
 * 040-26 (20 pranchas, 42 MB): `POST /api/nexo/volume` devolvia 200, o PDF
 * ficava pronto na memória do navegador — e nunca era gravado. O `saveResult`
 * morava DEPOIS de `conferirVolume`, e a conferência relê o volume inteiro no
 * pdf.js rasterizando cada prancha para recortar o carimbo. Passados dez
 * minutos ela ainda moía, a tela dizia só "MONTANDO…", e o engenheiro não tinha
 * volume nenhum.
 *
 * O comentário que já estava no código dizia a intenção certa — "NÃO bloqueia o
 * download: quem decide o que fazer com o volume é ele" —, e a ordem das linhas
 * a contradizia. Aqui a intenção vira regra executável.
 *
 *   node scripts/test-entrega-do-volume.ts   (== npm run test:entrega-do-volume)
 */
import assert from "node:assert/strict";

import { entregarVolume } from "../server/nexo/entrega-do-volume.ts";

let passed = 0;
function test(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ok  ${name}`);
    })
    .catch((err) => {
      console.error(`FALHOU  ${name}`);
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    });
}

/** Um relógio de eventos: só a ORDEM importa, e ela precisa ser observável. */
function diario() {
  const linhas: string[] = [];
  return { linhas, anota: (o: string) => linhas.push(o) };
}

await test("grava o volume ANTES de começar a conferir", async () => {
  const d = diario();
  await entregarVolume({
    montar: async () => {
      d.anota("montou");
      return { paginas: 27 };
    },
    salvar: async (_m, conferencia) => {
      d.anota(conferencia == null ? "salvou-sem-conferencia" : "salvou-com-conferencia");
    },
    conferir: async () => {
      d.anota("conferiu");
      return { ok: true };
    },
  });
  assert.deepEqual(d.linhas, [
    "montou",
    "salvou-sem-conferencia",
    "conferiu",
    "salvou-com-conferencia",
  ]);
});

await test("conferência lenta não segura a entrega", async () => {
  const d = diario();
  let liberarConferencia: (() => void) | null = null;
  const conferenciaTravada = new Promise<void>((r) => {
    liberarConferencia = r;
  });

  const entrega = entregarVolume({
    montar: async () => ({ paginas: 27 }),
    salvar: async (_m, c) => {
      d.anota(c == null ? "entregue" : "conferido");
    },
    conferir: async () => {
      await conferenciaTravada;
      return { ok: true };
    },
  });

  // Deixa o laço de eventos girar: a entrega tem de ter acontecido mesmo com a
  // conferência ainda pendurada. É o cenário real do volume de 42 MB.
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(d.linhas, ["entregue"], "o volume precisa existir antes da conferência");

  liberarConferencia!();
  await entrega;
  assert.deepEqual(d.linhas, ["entregue", "conferido"]);
});

await test("conferência que explode não apaga o volume já entregue", async () => {
  const d = diario();
  const falhas: unknown[] = [];
  const montado = await entregarVolume({
    montar: async () => ({ paginas: 27 }),
    salvar: async (_m, c) => {
      d.anota(c == null ? "entregue" : "conferido");
    },
    conferir: async () => {
      throw new Error("pdf.js caiu");
    },
    aoFalharConferencia: (e) => falhas.push(e),
  });
  assert.deepEqual(d.linhas, ["entregue"], "a entrega sobrevive à conferência quebrada");
  assert.equal(montado.paginas, 27, "quem chamou recebe o volume montado");
  assert.equal(falhas.length, 1, "a falha não some — ela é reportada");
});

await test("avisa a tela no instante da entrega, não no fim da conferência", async () => {
  const d = diario();
  let liberar: (() => void) | null = null;
  const travada = new Promise<void>((r) => {
    liberar = r;
  });

  const entrega = entregarVolume({
    montar: async () => ({ paginas: 27 }),
    salvar: async (_m, c) => d.anota(c == null ? "gravou" : "atualizou"),
    conferir: async () => {
      await travada;
      return { ok: true };
    },
    aoEntregar: () => d.anota("avisou-a-tela"),
  });

  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(
    d.linhas,
    ["gravou", "avisou-a-tela"],
    "o botão precisa sair de MONTANDO assim que o volume existe",
  );

  liberar!();
  await entrega;
  assert.deepEqual(d.linhas, ["gravou", "avisou-a-tela", "atualizou"]);
});

await test("montagem que falha não grava nada", async () => {
  const d = diario();
  await assert.rejects(
    entregarVolume({
      montar: async () => {
        throw new Error("Falha ao montar o volume.");
      },
      salvar: async () => d.anota("salvou"),
      conferir: async () => ({ ok: true }),
    }),
    /Falha ao montar o volume/,
  );
  assert.deepEqual(d.linhas, [], "sem PDF não há o que entregar");
});

console.log(`\n${passed} teste(s) passaram.`);
