/**
 * Teste de QUANDO A AUDITORIA EM VOO É RETOMADA SOZINHA.
 *
 * Em 15/09/2026 a jornada c5 auditou em A e abriu B com a análise ainda
 * rodando: B ficou marcada por ~1s e a tela voltou sozinha para A. A retomada
 * existe para o F5 (a página nasce noutra conversa e a auditoria em voo precisa
 * ser reaberta), mas ela só se dava por decidida quando retomava — com A já
 * aberta na carga, a decisão ficava para depois, e o primeiro clique para longe
 * de A virava a "carga". A regra: decide-se UMA vez, quando a lista de conversas
 * chega pela primeira vez; depois disso, trocar de conversa é escolha de quem
 * usa, nunca motivo para puxar de volta.
 *
 *   node scripts/test-retomada-da-auditoria.ts
 */
import assert from "node:assert/strict";

import { decidirRetomada } from "../modules/nexo/lib/retomada-da-auditoria.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

const A = { id: "A", temAuditoriaPendente: true };
const B = { id: "B" };

test("lista ainda não chegou: nada decidido, nada retomado", () => {
  assert.deepEqual(
    decidirRetomada({ jaDecidiu: false, conversas: [], aberta: "nova" }),
    {
      decidiu: false,
      retomar: null,
    },
  );
});

test("F5 com a página nascendo noutra conversa: retoma a que audita", () => {
  assert.deepEqual(
    decidirRetomada({ jaDecidiu: false, conversas: [A, B], aberta: "nova" }),
    {
      decidiu: true,
      retomar: "A",
    },
  );
});

test("F5 que ainda cai em B (última lembrada) com A auditando: retoma A", () => {
  assert.deepEqual(
    decidirRetomada({ jaDecidiu: false, conversas: [A, B], aberta: "B" }),
    {
      decidiu: true,
      retomar: "A",
    },
  );
});

test("carga com a própria A já aberta: decidido, sem retomar", () => {
  assert.deepEqual(
    decidirRetomada({ jaDecidiu: false, conversas: [A, B], aberta: "A" }),
    {
      decidiu: true,
      retomar: null,
    },
  );
});

test("carga sem auditoria nenhuma: decidido, sem retomar", () => {
  assert.deepEqual(
    decidirRetomada({
      jaDecidiu: false,
      conversas: [{ id: "A" }, B],
      aberta: "A",
    }),
    {
      decidiu: true,
      retomar: null,
    },
  );
});

test("c5: decidido na carga, a pessoa abre B com A auditando — não puxa de volta", () => {
  assert.deepEqual(
    decidirRetomada({ jaDecidiu: true, conversas: [A, B], aberta: "B" }),
    {
      decidiu: false,
      retomar: null,
    },
  );
});

/*
 * O caminho completo do c5, passo a passo, como o effect o vê: a carga chega
 * sem bilhete, a auditoria começa em A (a lista ganha o bilhete com A aberta) e
 * a pessoa abre B. Nenhum passo pode pedir a volta para A.
 */
test("c5 em sequência: carga, auditoria começa em A, abre B — nenhuma retomada", () => {
  let jaDecidiu = false;
  const passos = [
    { conversas: [], aberta: "nova" },
    { conversas: [{ id: "A" }, B], aberta: "A" },
    { conversas: [A, B], aberta: "A" },
    { conversas: [A, B], aberta: "B" },
  ];
  for (const passo of passos) {
    const r = decidirRetomada({ jaDecidiu, ...passo });
    assert.equal(
      r.retomar,
      null,
      `passo aberta=${passo.aberta} pediu retomar ${r.retomar}`,
    );
    if (r.decidiu) jaDecidiu = true;
  }
});

console.log(`\n${passed} teste(s) passaram`);
