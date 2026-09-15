/**
 * A GRAVAÇÃO DA CONVERSA NÃO PODE DEIXAR ESTADO COMITADO FORA DO DISCO.
 *
 * O caso medido (14/09/2026, jornada a3 da bateria, reauditar o 117_25): a
 * rodada 2 fechava certa na tela e só a rodada 1 ia para o disco. `saveResult`
 * muda o estado e AGENDA; na mesma volta `marcarAuditoriaPendente(null)` grava
 * JÁ — lendo um snapshot que só acompanha o estado depois do commit do React.
 * A revisão achou o mesmo desenho sem debounce nenhum: `salvarDossieDoMemorial`
 * troca o título por `setTitle` e grava já, e o título velho ia para o disco.
 *
 * O "store" daqui imita o `conversation-store.tsx` no que importa:
 * - o estado muda por FILA, e o React comita `commitMs` depois (não na hora);
 * - o snapshot só recebe o estado no commit (o effect da linha ~402), e o id
 *   da conversa só troca nesse commit;
 * - quem grava já escreve à mão SÓ o próprio campo no snapshot;
 * - `selectConversation` dá flush, espera leituras (`esperaMs`), escreve o
 *   `memorialMeta` e o `createdAt` da conversa NOVA no snapshot com o id ainda
 *   antigo, e só então pede a troca de estado.
 * - effects rodam dos filhos para o pai: `commitSemEfeitos` devolve o effect do
 *   provider de um commit para o teste rodá-lo DEPOIS de um flush feito num
 *   effect de filho ou numa continuação assíncrona (segunda rodada da revisão).
 * As chamadas opcionais (`?.`) e os ramos por API são o que o store passou a
 * fazer; contra o helper de 13ce603 ou de ae3f61a, o modelo vira aquele store —
 * é assim que o teste mostra o vermelho lá.
 *
 *   node scripts/test-agenda-de-gravacao.ts   (== npm run test:agenda-de-gravacao)
 */
import assert from "node:assert/strict";

import {
  criarAgendaDeGravacao,
  type Relogio,
} from "../modules/nexo/lib/agenda-de-gravacao.ts";

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

/** Um relógio que só anda quando o teste manda, 1ms por vez. */
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
  return { relogio, avancar, esperar, agora: () => agora };
}

type Campos = {
  id: string;
  title: string;
  results: string[];
  memorial: string;
  pendente: boolean;
  /** A geração da gravação imediata que o estado comitado carrega. */
  geracao: number;
};
type Foto = Omit<Campos, "geracao"> & { createdAt: number; em: number };

const CONVERSA_B: Omit<Campos, "geracao"> & { createdAt: number } = {
  id: "B",
  title: "B",
  results: ["B:parecer"],
  memorial: "B:memorial",
  pendente: false,
  createdAt: 999,
};

/** A API de ae3f61a, para o modelo rodar contra ela e mostrar o vermelho. */
type AgendaLegada = {
  proximaSincronizacao: (limiteMs: number) => Promise<void>;
};

function storeDeMentira({ commitMs = 25 } = {}) {
  const r = relogioDeMentira();
  let estado: Campos = {
    id: "A",
    title: "Nova conversa",
    results: ["rodada-1"],
    memorial: "A:memorial",
    pendente: true,
    geracao: 0,
  };
  let snapshot: Omit<Campos, "geracao"> & { createdAt: number } = {
    ...estado,
    createdAt: 100,
  };
  const fila: ((e: Campos) => Campos)[] = [];
  let commitArmado: unknown = null;
  const disco: Foto[] = [];
  const agenda = criarAgendaDeGravacao({ esperaMs: 500, relogio: r.relogio });
  const conversaAtual = () => snapshot.id;
  const persistNow = () => {
    disco.push({ ...snapshot, results: [...snapshot.results], em: r.agora() });
  };

  function set(fn: (e: Campos) => Campos) {
    fila.push(fn);
    if (commitArmado !== null) return;
    commitArmado = r.relogio.armar(() => commitSemEfeitos()(), commitMs);
  }
  /**
   * O render + commit, SEM rodar os effects: devolve o effect do provider
   * daquele commit, para o teste decidir quando ele roda (effects de filhos
   * rodam antes do pai).
   */
  function commitSemEfeitos() {
    if (commitArmado !== null) r.relogio.desarmar(commitArmado);
    commitArmado = null;
    for (const fn of fila.splice(0)) estado = fn(estado);
    const doCommit = estado;
    return () => {
      // O effect que sincroniza o snapshot (linha ~402), e o que roda depois.
      const { geracao, ...campos } = doCommit;
      snapshot = {
        ...snapshot,
        ...campos,
        createdAt: snapshot.createdAt || r.agora(),
      };
      agenda.aoSincronizar?.(persistNow, conversaAtual, geracao);
    };
  }
  /** Devolve a geração quando a agenda tem (o store de agora), ou nada. */
  function flushPersist(): number | undefined {
    const alvo: unknown = agenda.gravarJa(persistNow, conversaAtual);
    if (typeof alvo !== "number") return undefined;
    set((e) => ({ ...e, geracao: alvo }));
    return alvo;
  }

  return {
    r,
    disco,
    gravacoesDe: (id: string) => disco.filter((g) => g.id === id),
    ultimaDe: (id: string) => disco.filter((g) => g.id === id).at(-1),
    /** Algum estado muda e um commit fica pronto para acontecer. */
    renderizar() {
      set((e) => ({ ...e }));
    },
    commitSemEfeitos,
    saveResult(artefato: string) {
      set((e) => ({ ...e, results: [...e.results, artefato] }));
      agenda.agendar(persistNow);
    },
    marcarAuditoriaPendenteNull() {
      set((e) => ({ ...e, pendente: false }));
      snapshot = { ...snapshot, pendente: false };
      flushPersist();
    },
    salvarDossieDoMemorial(titulo: string) {
      const memorial = `${snapshot.memorial}+dossie`;
      set((e) => ({ ...e, memorial }));
      snapshot = { ...snapshot, memorial };
      set((e) => ({ ...e, title: titulo }));
      flushPersist();
    },
    async selectConversation(b: typeof CONVERSA_B, esperaMs: number) {
      const alvo = flushPersist();
      if (alvo !== undefined) {
        await agenda.proximaSincronizacao(alvo, 1000);
      } else if (agenda.proximaSincronizacao) {
        set((e) => ({ ...e })); // ae3f61a: o pulso que forçava o commit
        await (agenda as unknown as AgendaLegada).proximaSincronizacao(1000);
      }
      await r.esperar(esperaMs);
      agenda.esquecerPedido?.();
      snapshot = { ...snapshot, memorial: b.memorial };
      set((e) => ({
        id: b.id,
        title: b.title,
        results: b.results,
        memorial: b.memorial,
        pendente: b.pendente,
        geracao: e.geracao,
      }));
      snapshot = { ...snapshot, createdAt: b.createdAt };
    },
  };
}

await test("a3: flush logo depois de saveResult grava a rodada 2", async () => {
  const s = storeDeMentira();
  s.saveResult("rodada-2");
  s.marcarAuditoriaPendenteNull();
  await s.r.avancar(1000);
  assert.deepEqual(s.ultimaDe("A")?.results, ["rodada-1", "rodada-2"]);
  assert.equal(s.ultimaDe("A")?.pendente, false);
});

await test("a3: a rodada 2 chega ao disco junto com o commit, não meio segundo depois", async () => {
  const s = storeDeMentira();
  s.saveResult("rodada-2");
  s.marcarAuditoriaPendenteNull();
  await s.r.avancar(100);
  assert.deepEqual(s.ultimaDe("A")?.results, ["rodada-1", "rodada-2"]);
});

await test("o flush continua gravando NA HORA o campo que ele mesmo escreveu", async () => {
  const s = storeDeMentira();
  s.saveResult("rodada-2");
  s.marcarAuditoriaPendenteNull();
  assert.equal(s.disco.length, 1);
  assert.equal(s.disco[0].pendente, false);
});

await test("dossiê: o título trocado por setTitle antes do flush vai para o disco", async () => {
  const s = storeDeMentira();
  s.salvarDossieDoMemorial("117-25-CRICIUMA");
  await s.r.avancar(1000);
  assert.equal(s.ultimaDe("A")?.title, "117-25-CRICIUMA");
  assert.equal(s.ultimaDe("A")?.memorial, "A:memorial+dossie");
});

await test("trocar de conversa com leituras rápidas: a mudança de A vai para A, nunca para B", async () => {
  const s = storeDeMentira();
  s.saveResult("rodada-2");
  const abrindo = s.selectConversation(CONVERSA_B, 2);
  await s.r.avancar(1000);
  await abrindo;
  assert.deepEqual(s.ultimaDe("A")?.results, ["rodada-1", "rodada-2"]);
  assert.ok(
    s.gravacoesDe("B").every((g) => !g.results.includes("rodada-2")),
    `a rodada de A foi gravada em B: ${JSON.stringify(s.gravacoesDe("B"))}`,
  );
});

await test("trocar de conversa: campos de B nunca são gravados sob o id de A", async () => {
  for (const esperaMs of [2, 30, 480, 490, 499, 510]) {
    const s = storeDeMentira();
    s.saveResult("rodada-2");
    const abrindo = s.selectConversation(CONVERSA_B, esperaMs);
    await s.r.avancar(2000);
    await abrindo;
    const deA = s.gravacoesDe("A");
    assert.ok(
      deA.every(
        (g) =>
          g.memorial === "A:memorial" &&
          g.createdAt === 100 &&
          !g.results.includes("B:parecer"),
      ),
      `esperaMs=${esperaMs}: A gravada com campos de B: ${JSON.stringify(deA)}`,
    );
  }
});

await test("abrir outra conversa não grava a conversa recém-aberta sem mudança", async () => {
  const s = storeDeMentira();
  const abrindo = s.selectConversation(CONVERSA_B, 40);
  await s.r.avancar(2000);
  await abrindo;
  assert.equal(
    s.gravacoesDe("B").length,
    0,
    JSON.stringify(s.gravacoesDe("B")),
  );
});

await test("flush sem nada agendado grava e não deixa nada pendurado", async () => {
  const s = storeDeMentira();
  s.marcarAuditoriaPendenteNull();
  await s.r.avancar(1000);
  assert.ok(s.disco.length >= 1);
  assert.ok(s.disco.every((g) => g.id === "A" && g.pendente === false));
});

await test("debounce: várias mudanças seguidas viram uma gravação só", async () => {
  const s = storeDeMentira();
  s.saveResult("a");
  await s.r.avancar(100);
  s.saveResult("b");
  await s.r.avancar(1000);
  assert.equal(s.disco.length, 1);
  assert.deepEqual(s.disco[0].results, ["rodada-1", "a", "b"]);
});

await test("descartar larga o debounce e o pedido do flush", async () => {
  const agenda = criarAgendaDeGravacao({
    esperaMs: 500,
    relogio: relogioDeMentira().relogio,
  });
  let gravou = 0;
  const gravar = () => {
    gravou++;
  };
  agenda.agendar(gravar);
  agenda.gravarJa(gravar, () => "A");
  agenda.descartar();
  agenda.aoSincronizar?.(gravar, () => "A", 99);
  assert.equal(gravou, 1);
});

await test("effect de filho limpa o bilhete: o sync do commit ANTERIOR não regrava o bilhete velho", async () => {
  // `use-reconectar-auditoria` limpa o bilhete residual de dentro de um
  // effect. Effects rodam dos filhos para o pai: o do provider que vem logo
  // depois é o do commit que AINDA tinha o bilhete.
  const s = storeDeMentira();
  s.renderizar();
  const efeitoDoProviderDoCommitAnterior = s.commitSemEfeitos();
  s.marcarAuditoriaPendenteNull(); // effect do filho
  efeitoDoProviderDoCommitAnterior();
  await s.r.avancar(1000); // o commit que traz o bilhete nulo
  assert.equal(
    s.ultimaDe("A")?.pendente,
    false,
    JSON.stringify(s.gravacoesDe("A")),
  );
});

await test("a3 entre um commit e seus effects: o flush do finally não perde a rodada 2", async () => {
  // O `finally` de `confirm()` é continuação assíncrona: pode rodar depois de
  // um commit qualquer e antes dos effects dele.
  const s = storeDeMentira();
  s.renderizar();
  const efeitoDoProviderDoCommitAnterior = s.commitSemEfeitos();
  s.saveResult("rodada-2");
  s.marcarAuditoriaPendenteNull();
  efeitoDoProviderDoCommitAnterior();
  await s.r.avancar(1000);
  assert.deepEqual(s.ultimaDe("A")?.results, ["rodada-1", "rodada-2"]);
  assert.equal(s.ultimaDe("A")?.pendente, false);
});

await test("trocar de conversa de dentro de um effect de filho: espera o commit certo", async () => {
  const s = storeDeMentira();
  s.renderizar();
  const efeitoDoProviderDoCommitAnterior = s.commitSemEfeitos();
  s.saveResult("rodada-2");
  const abrindo = s.selectConversation(CONVERSA_B, 2);
  efeitoDoProviderDoCommitAnterior();
  await s.r.avancar(1000);
  await abrindo;
  assert.deepEqual(s.ultimaDe("A")?.results, ["rodada-1", "rodada-2"]);
  assert.ok(
    s.gravacoesDe("B").every((g) => !g.results.includes("rodada-2")),
    JSON.stringify(s.gravacoesDe("B")),
  );
});

await test("a espera pela sincronização desarma o limite quando resolve", async () => {
  const r = relogioDeMentira();
  let armados = 0;
  let desarmados = 0;
  const relogio: Relogio = {
    armar: (fn, ms) => {
      armados++;
      return r.relogio.armar(fn, ms);
    },
    desarmar: (alca) => {
      desarmados++;
      r.relogio.desarmar(alca);
    },
  };
  const agenda = criarAgendaDeGravacao({ esperaMs: 500, relogio });
  const alvo = agenda.gravarJa(
    () => {},
    () => "A",
  );
  const esperando = agenda.proximaSincronizacao(alvo, 1000);
  agenda.aoSincronizar(
    () => {},
    () => "A",
    alvo,
  );
  await esperando;
  assert.equal(armados, 1);
  assert.equal(desarmados, 1);
});

console.log(`\n${passed} ok`);
