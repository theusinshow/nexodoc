/**
 * "NOVA CONVERSA" NÃO PERDE A ÚLTIMA MUDANÇA NEM É DESFEITA PELO F5 EM VOO.
 *
 * As duas suspeitas abertas da onda final da segunda rodada (15/09/2026):
 *
 * 1. `newConversation` era síncrono: dava o flush e trocava o estado na MESMA
 *    volta. O flush grava o snapshot, que só recebe o estado no commit do React;
 *    uma mudança agendada no mesmo tick logo antes (`await saveResult(...)` e
 *    `newConversation()` em seguida) chegava ao React junto com a troca — o
 *    commit que a trazia já trazia o id novo, e ela nunca era gravada em A.
 *    `selectConversation` não tem o defeito porque espera o commit do flush.
 * 2. "A última abertura vence" contava só `selectConversation`: a abertura do F5
 *    esperando a lista do servidor (até 4s) ainda trocava por cima de um "Nova
 *    conversa" dado no meio.
 *
 * O "store" daqui imita o `conversation-store.tsx` no que importa, como o de
 * `test-agenda-de-gravacao.ts`: o estado muda por fila e o React comita
 * `commitMs` depois; o snapshot só recebe o estado no effect do commit, que
 * chama `aoSincronizar` com a geração comitada; o debounce e o flush põem a
 * geração deles no estado na mesma volta da mudança.
 *
 *   node scripts/test-nova-conversa.ts
 */
import assert from "node:assert/strict";

import {
  criarAgendaDeGravacao,
  type Relogio,
} from "../modules/nexo/lib/agenda-de-gravacao.ts";
import { comecarNovaConversa } from "../modules/nexo/lib/nova-conversa.ts";
import { criarUltimaAbertura } from "../modules/nexo/lib/ultima-abertura.ts";

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

async function microtarefas() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function relogioDeMentira() {
  let agora = 0;
  let proxima = 1;
  const pendentes = new Map<number, { quando: number; fn: () => void }>();
  const relogio: Relogio = {
    armar: (fn, ms) => {
      const alca = proxima++;
      pendentes.set(alca, { quando: agora + ms, fn });
      return alca;
    },
    desarmar: (alca) => {
      pendentes.delete(alca as number);
    },
  };
  async function avancar(ms: number) {
    for (let i = 0; i < ms; i++) {
      agora++;
      const vencidas = [...pendentes]
        .filter(([, p]) => p.quando <= agora)
        .sort((a, b) => a[1].quando - b[1].quando || a[0] - b[0]);
      for (const [alca, p] of vencidas) {
        if (!pendentes.has(alca)) continue;
        pendentes.delete(alca);
        p.fn();
      }
      await microtarefas();
    }
  }
  const esperar = (ms: number) =>
    new Promise<void>((resolve) => relogio.armar(resolve, ms));
  return { relogio, avancar, esperar };
}

type Campos = { id: string; results: string[]; geracao: number };

function storeDeMentira({ commitMs = 25 } = {}) {
  const r = relogioDeMentira();
  let estado: Campos = { id: "A", results: ["rodada-1"], geracao: 0 };
  let snapshot = { id: "A", results: ["rodada-1"] };
  /*
   * DUAS FAIXAS DE PRIORIDADE, como o React (revisão da frente A, 15/09/2026).
   * O que muda numa continuação assíncrona (`await saveResult(...)`) é da faixa
   * padrão; o que muda dentro de `flushSync` (o `reset` da tela) é síncrono e
   * comita NA HORA, pulando o que é da padrão — que volta depois, rebaseado.
   * Com uma faixa só, o modelo não via o defeito que a revisão achou.
   */
  let base: Campos = estado;
  const fila: { fn: (e: Campos) => Campos; faixa: "sync" | "padrao" }[] = [];
  let faixaAtual: "sync" | "padrao" = "padrao";
  let commitArmado: unknown = null;
  const disco: { id: string; results: string[] }[] = [];
  const agenda = criarAgendaDeGravacao({ esperaMs: 500, relogio: r.relogio });
  const aberturas = criarUltimaAbertura();
  const conversaAtual = () => snapshot.id;
  // A guarda de vazia do `persistNow`: conversa nova sem nada não vai ao disco.
  const persistNow = () => {
    if (snapshot.id !== "A" && snapshot.results.length === 0) return;
    disco.push({ id: snapshot.id, results: [...snapshot.results] });
  };
  let zerou = 0;

  function comitar(render: Campos) {
    estado = render;
    const { geracao, ...campos } = render;
    snapshot = { ...campos };
    agenda.aoSincronizar(persistNow, conversaAtual, geracao);
  }
  function set(fn: (e: Campos) => Campos) {
    fila.push({ fn, faixa: faixaAtual });
    if (faixaAtual === "sync" || commitArmado !== null) return;
    commitArmado = r.relogio.armar(() => {
      commitArmado = null;
      let render = base;
      for (const u of fila.splice(0)) render = u.fn(render);
      base = render;
      comitar(render);
    }, commitMs);
  }
  /** `flushSync`: o que muda dentro comita já, só a faixa síncrona. */
  function flushSync(fn: () => void) {
    faixaAtual = "sync";
    try {
      fn();
    } finally {
      faixaAtual = "padrao";
    }
    let render = base;
    for (const u of fila) if (u.faixa === "sync") render = u.fn(render);
    if (!fila.some((u) => u.faixa === "padrao")) {
      base = render;
      fila.splice(0);
    }
    comitar(render);
  }
  function flushPersist() {
    const g = agenda.gravarJa(persistNow, conversaAtual);
    set((e) => ({ ...e, geracao: g }));
    return g;
  }
  function schedulePersist() {
    // O store de agora põe a geração do debounce no estado; o de antes não tinha.
    const g: unknown = agenda.agendar(persistNow);
    if (typeof g === "number")
      set((e) => ({ ...e, geracao: Math.max(e.geracao, g) }));
  }

  return {
    r,
    disco,
    estado: () => estado,
    flushSync,
    zerou: () => zerou,
    ultimaDe: (id: string) => disco.filter((g) => g.id === id).at(-1),
    saveResult(artefato: string) {
      set((e) => ({ ...e, results: [...e.results, artefato] }));
      schedulePersist();
    },
    newConversation(opts?: { descartar?: boolean }) {
      void comecarNovaConversa({
        agenda,
        aberturas,
        descartar: Boolean(opts?.descartar),
        flush: flushPersist,
        idNovo: "N",
        zerar: () => {
          zerou++;
          set((e) => ({ id: "N", results: [], geracao: e.geracao }));
        },
      });
    },
    /**
     * A abertura (`selectConversation`): pega a vez, dá o flush, espera o commit
     * dele e as leituras (a lista do servidor), e troca, se ainda valer.
     */
    async abrir(id: string, esperaMs: number) {
      const minha = aberturas.comecar();
      // O store de agora espera antes o commit da mudança pendente.
      const api = agenda as unknown as {
        geracaoSemCommit?: () => number | null;
      };
      const pendente = api.geracaoSemCommit?.() ?? null;
      if (pendente !== null) {
        await agenda.proximaSincronizacao(pendente, 1000);
        if (!aberturas.valeAinda(minha)) return null;
      }
      await agenda.proximaSincronizacao(flushPersist(), 1000);
      if (!aberturas.valeAinda(minha)) return null;
      await r.esperar(esperaMs);
      if (!aberturas.valeAinda(minha)) return null;
      agenda.comecarTroca(id);
      set((e) => ({ id, results: [`${id}:parecer`], geracao: e.geracao }));
      return id;
    },
  };
}

await test("mudança agendada no mesmo tick logo antes de 'Nova conversa' vai para A", async () => {
  const s = storeDeMentira();
  s.saveResult("rodada-2");
  s.newConversation();
  await s.r.avancar(2000);
  assert.deepEqual(
    s.ultimaDe("A")?.results,
    ["rodada-1", "rodada-2"],
    `disco=${JSON.stringify(s.disco)}`,
  );
  assert.equal(s.estado().id, "N");
  assert.ok(
    s.disco.every((g) => g.id === "A"),
    `gravou a conversa nova: ${JSON.stringify(s.disco)}`,
  );
});

await test("sem mudança pendente, 'Nova conversa' troca na mesma volta (como sempre foi)", async () => {
  const s = storeDeMentira();
  s.saveResult("rodada-2");
  await s.r.avancar(2000);
  s.newConversation();
  assert.equal(s.zerou(), 1, "a troca não saiu na mesma volta");
  await s.r.avancar(2000);
  assert.equal(s.estado().id, "N");
  assert.deepEqual(s.ultimaDe("A")?.results, ["rodada-1", "rodada-2"]);
});

await test("descartar larga a mudança pendente e troca na mesma volta", async () => {
  const s = storeDeMentira();
  s.saveResult("apagada");
  s.newConversation({ descartar: true });
  assert.equal(s.zerou(), 1);
  await s.r.avancar(2000);
  assert.equal(s.estado().id, "N");
  assert.ok(
    s.disco.every((g) => !g.results.includes("apagada")),
    JSON.stringify(s.disco),
  );
});

await test("'Nova conversa' dada com a abertura do F5 em voo: a abertura desiste", async () => {
  const s = storeDeMentira();
  const abrindo = s.abrir("B", 300);
  await s.r.avancar(50);
  s.newConversation();
  await s.r.avancar(2000);
  assert.equal(await abrindo, null, "a abertura do F5 trocou por cima");
  assert.equal(s.estado().id, "N");
});

await test("abertura pedida DEPOIS de uma 'Nova conversa' que espera o commit: vale a abertura", async () => {
  const s = storeDeMentira();
  s.saveResult("rodada-2");
  s.newConversation();
  const abrindo = s.abrir("B", 10);
  await s.r.avancar(2000);
  assert.equal(await abrindo, "B");
  assert.equal(s.estado().id, "B");
  assert.deepEqual(s.ultimaDe("A")?.results, ["rodada-1", "rodada-2"]);
});

await test("'Nova conversa' dentro de flushSync (o reset da tela) com mudança pendente na faixa padrão: a mudança vai para A", async () => {
  // A revisão da frente A: o flush pedia a geração dele na faixa síncrona, o
  // commit síncrono a trazia SEM a mudança da faixa padrão, a espera resolvia,
  // A era gravada sem ela e a troca chegava junto com a mudança rebaseada.
  const s = storeDeMentira();
  s.saveResult("rodada-2");
  s.flushSync(() => s.newConversation());
  await s.r.avancar(2000);
  assert.deepEqual(
    s.ultimaDe("A")?.results,
    ["rodada-1", "rodada-2"],
    `disco=${JSON.stringify(s.disco)}`,
  );
  assert.equal(s.estado().id, "N");
});

await test("dentro de flushSync sem mudança pendente: troca no próprio commit síncrono", async () => {
  const s = storeDeMentira();
  s.saveResult("rodada-2");
  await s.r.avancar(2000);
  s.flushSync(() => s.newConversation());
  assert.equal(s.estado().id, "N");
  await s.r.avancar(2000);
  assert.deepEqual(s.ultimaDe("A")?.results, ["rodada-1", "rodada-2"]);
});

await test("abrir outra conversa por um clique (faixa síncrona) com mudança pendente na faixa padrão: a mudança vai para A", async () => {
  // O mesmo defeito em `selectConversation`: o flush do clique comita na hora,
  // sem a mudança da faixa padrão, e a espera pelo commit dele resolve cedo.
  const s = storeDeMentira();
  s.saveResult("rodada-2");
  let abrindo: Promise<string | null> = Promise.resolve(null);
  s.flushSync(() => {
    abrindo = s.abrir("B", 10);
  });
  await s.r.avancar(2000);
  assert.equal(await abrindo, "B");
  assert.deepEqual(
    s.ultimaDe("A")?.results,
    ["rodada-1", "rodada-2"],
    `disco=${JSON.stringify(s.disco)}`,
  );
});

console.log(`\n${passed} ok`);
