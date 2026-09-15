/**
 * A AGENDA DE GRAVAÇÃO DA CONVERSA: um flush não pode apagar a gravação que o
 * debounce ainda devia fazer.
 *
 * O caso medido (14/09/2026, jornada a3 da bateria, reauditar o 117_25): a
 * rodada 2 fechava certa na tela e só a rodada 1 ia para o disco. `saveResult`
 * muda o estado e AGENDA; na mesma volta `marcarAuditoriaPendente(null)` grava
 * JÁ — lendo um snapshot que só acompanha o estado depois do commit do React.
 * O flush cancelava o debounce e gravava o velho; ninguém gravava o novo.
 *
 * O "store" daqui reproduz só essa assimetria: `estado` muda na hora, `snapshot`
 * só no `commit()` — como o `useEffect` que sincroniza o `snapshotRef`.
 *
 *   node scripts/test-agenda-de-gravacao.ts   (== npm run test:agenda-de-gravacao)
 */
import assert from "node:assert/strict";

import {
  criarAgendaDeGravacao,
  type Relogio,
} from "../modules/nexo/lib/agenda-de-gravacao.ts";

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

/** Um relógio que só anda quando o teste manda. */
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
  function avancar(ms: number) {
    agora += ms;
    const vencidas = [...pendentes]
      .filter(([, p]) => p.quando <= agora)
      .sort((a, b) => a[1].quando - b[1].quando);
    for (const [alca, p] of vencidas) {
      if (!pendentes.has(alca)) continue;
      pendentes.delete(alca);
      p.fn();
    }
  }
  return { relogio, avancar, pendentes: () => pendentes.size };
}

type Foto = { conversa: string; results: string[]; pendente: boolean };

function storeDeMentira() {
  const r = relogioDeMentira();
  let estado: Foto = { conversa: "A", results: ["rodada-1"], pendente: true };
  let snapshot: Foto = { ...estado };
  const gravados: Foto[] = [];
  const agenda = criarAgendaDeGravacao({
    esperaMs: 500,
    relogio: r.relogio,
  });
  const conversaAtual = () => snapshot.conversa;
  const gravar = () => {
    gravados.push({ ...snapshot, results: [...snapshot.results] });
  };
  return {
    r,
    gravados,
    agenda,
    gravar,
    conversaAtual,
    /** Um setter do store que só agenda (`saveResult`, `appendMessage`...). */
    mudarEAgendar(patch: Partial<Foto>) {
      estado = { ...estado, ...patch };
      agenda.agendar(gravar);
    },
    /** Um setter que escreve o PRÓPRIO campo no snapshot e grava já. */
    mudarEGravarJa(patch: Partial<Foto>) {
      estado = { ...estado, ...patch };
      snapshot = { ...snapshot, ...patch };
      agenda.gravarJa(gravar, conversaAtual);
    },
    /** Abrir outra conversa: estado novo, comitado, sem agendar nada. */
    trocarConversa(conversa: string) {
      estado = { conversa, results: [], pendente: false };
      snapshot = { ...estado };
    },
    /** O commit do React: o effect copia o estado inteiro para o snapshot. */
    commit() {
      snapshot = { ...estado };
    },
  };
}

test("reauditar: flush logo depois de saveResult não perde a rodada 2 no disco", () => {
  const s = storeDeMentira();
  // `saveResult` da rodada 2, e no `finally` o bilhete sai — na mesma volta.
  s.mudarEAgendar({ results: ["rodada-1", "rodada-2"] });
  s.mudarEGravarJa({ pendente: false });
  // O React comita ~26ms depois (medido na a3).
  s.r.avancar(30);
  s.commit();
  s.r.avancar(1000);
  const ultima = s.gravados.at(-1);
  assert.deepEqual(ultima?.results, ["rodada-1", "rodada-2"]);
  assert.equal(ultima?.pendente, false);
});

test("o flush continua gravando NA HORA o campo que ele mesmo escreveu", () => {
  const s = storeDeMentira();
  s.mudarEAgendar({ results: ["rodada-1", "rodada-2"] });
  s.mudarEGravarJa({ pendente: false });
  assert.equal(s.gravados.length, 1);
  assert.equal(s.gravados[0].pendente, false);
});

test("flush sem nada agendado grava uma vez e não deixa gravação pendente", () => {
  const s = storeDeMentira();
  s.mudarEGravarJa({ pendente: false });
  s.r.avancar(1000);
  assert.equal(s.gravados.length, 1);
  assert.equal(s.r.pendentes(), 0);
});

test("debounce: várias mudanças seguidas viram uma gravação só", () => {
  const s = storeDeMentira();
  s.mudarEAgendar({ results: ["a"] });
  s.r.avancar(100);
  s.mudarEAgendar({ results: ["a", "b"] });
  s.r.avancar(100);
  s.commit();
  s.r.avancar(1000);
  assert.equal(s.gravados.length, 1);
  assert.deepEqual(s.gravados[0].results, ["a", "b"]);
});

test("trocar de conversa: o flush da troca não grava a conversa NOVA depois", () => {
  const s = storeDeMentira();
  s.mudarEAgendar({ results: ["rodada-1", "rodada-2"] });
  s.commit();
  // `selectConversation`/`newConversation`: flush, e só então a troca de id.
  s.agenda.gravarJa(s.gravar, s.conversaAtual);
  s.trocarConversa("B");
  s.r.avancar(1000);
  assert.ok(
    s.gravados.every((g) => g.conversa === "A"),
    `gravou a outra conversa depois da troca: ${JSON.stringify(s.gravados)}`,
  );
  assert.deepEqual(s.gravados.at(-1)?.results, ["rodada-1", "rodada-2"]);
});

test("descartar larga a gravação pendente, inclusive a que um flush deixou", () => {
  const s = storeDeMentira();
  s.mudarEAgendar({ results: ["x"] });
  s.mudarEGravarJa({ pendente: false });
  s.agenda.descartar();
  s.r.avancar(1000);
  assert.equal(s.gravados.length, 1);
  assert.equal(s.r.pendentes(), 0);
});

console.log(`\n${passed} ok`);
