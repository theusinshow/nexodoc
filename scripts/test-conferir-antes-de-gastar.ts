/**
 * A ABA DESATUALIZADA NÃO PAGA NEM O PRIMEIRO GESTO.
 *
 * Até aqui (HEAD 9cd14e6) a trava só acendia quando a aba GRAVAVA: o 409 do
 * servidor ou o disco mais novo que a base. A primeira auditoria, o primeiro
 * turno do agente ou a primeira conferência do volume de uma aba parada saíam
 * pagos — e o que voltasse seria descartado pela fila logo em seguida. Agora,
 * antes de gastar, a aba pergunta ao servidor a versão guardada e aplica a
 * MESMA regra da rota (`gravacaoDesatualizada`, com as próprias sem
 * confirmação). Desatualizada: trava como um 409. Servidor fora do alcance:
 * deixa gastar (o offline segue como era), mas não dá a base por conferida.
 *
 *   node scripts/test-conferir-antes-de-gastar.ts
 */
import assert from "node:assert/strict";

import {
  decidirAntesDeGastar,
  leituraDaResposta,
} from "../modules/nexo/lib/conferir-antes-de-gastar.ts";
import {
  criarFilaDeGravacao,
  type GanchosDaGravacao,
} from "../modules/nexo/lib/fila-de-gravacao.ts";

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
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

// ------------------------------------------------------------- a decisão ---

await test("servidor fora do alcance: gasta, e a base não fica conferida", () => {
  assert.deepEqual(
    decidirAntesDeGastar({
      leitura: { estado: "inalcancavel" },
      base: 1000,
      proprias: [],
    }),
    { gastar: true, conferida: false },
  );
});

await test("instalação sem banco: gasta, e a base não fica conferida", () => {
  assert.deepEqual(
    decidirAntesDeGastar({
      leitura: { estado: "sem-servidor" },
      base: 1000,
      proprias: [],
    }),
    { gastar: true, conferida: false },
  );
});

await test("o servidor guarda versão mais nova que a base e que não é desta aba: não gasta", () => {
  assert.equal(
    decidirAntesDeGastar({
      leitura: { estado: "lida", guardada: 2000 },
      base: 1000,
      proprias: [],
    }).gastar,
    false,
  );
});

await test("a versão mais nova do servidor é uma das próprias desta aba: gasta", () => {
  assert.deepEqual(
    decidirAntesDeGastar({
      leitura: { estado: "lida", guardada: 3000 },
      base: 1000,
      proprias: [3000],
    }),
    { gastar: true, conferida: true },
  );
});

await test("o servidor está na base (ou atrás dela): gasta, e a base fica conferida", () => {
  for (const guardada of [1000, 900]) {
    assert.deepEqual(
      decidirAntesDeGastar({
        leitura: { estado: "lida", guardada },
        base: 1000,
        proprias: [],
      }),
      { gastar: true, conferida: true },
    );
  }
});

await test("o servidor não tem a conversa, ou a conversa é nova (sem base): gasta", () => {
  assert.deepEqual(
    decidirAntesDeGastar({
      leitura: { estado: "lida", guardada: null },
      base: 1000,
      proprias: [],
    }),
    { gastar: true, conferida: false },
  );
  assert.equal(
    decidirAntesDeGastar({
      leitura: { estado: "lida", guardada: 5000 },
      base: null,
      proprias: [],
    }).gastar,
    true,
  );
});

// ------------------------------------------- a resposta da rota `?id=` ---

/*
 * A CONFERÊNCIA LÊ SÓ A VERSÃO DA CONVERSA (revisão da frente A, 15/09/2026):
 * `GET /api/nexo/conversas?id=` devolve o `updatedAt` daquela linha, sem a lista
 * inteira e sem as lápides. Como a resposta vira leitura é regra pura.
 */
await test("a rota respondeu a versão: lida, com a hora (ou null se não tem)", () => {
  assert.deepEqual(
    leituraDaResposta({
      ok: true,
      status: 200,
      corpo: { id: "A", updatedAt: 2000, sincronizando: true },
    }),
    { estado: "lida", guardada: 2000 },
  );
  assert.deepEqual(
    leituraDaResposta({
      ok: true,
      status: 200,
      corpo: { id: "A", updatedAt: null, sincronizando: true },
    }),
    { estado: "lida", guardada: null },
  );
});

await test("instalação sem banco ou módulo desligado (404): sem servidor", () => {
  assert.deepEqual(
    leituraDaResposta({
      ok: true,
      status: 200,
      corpo: { conversas: [], expurgadas: [], sincronizando: false },
    }),
    { estado: "sem-servidor" },
  );
  assert.deepEqual(leituraDaResposta({ ok: false, status: 404, corpo: null }), {
    estado: "sem-servidor",
  });
});

await test("erro do servidor, sessão caída ou corpo torto: fora do alcance", () => {
  for (const r of [
    { ok: false, status: 500, corpo: { error: "falha" } },
    { ok: false, status: 401, corpo: null },
    { ok: true, status: 200, corpo: null },
    {
      ok: true,
      status: 200,
      corpo: { sincronizando: true, updatedAt: "ontem" },
    },
  ]) {
    assert.deepEqual(
      leituraDaResposta(r),
      { estado: "inalcancavel" },
      JSON.stringify(r),
    );
  }
});

// ---------------------------------------------------------------- a fila ---

type Rec = { id: string; updatedAt: number; texto: string };

function mundo() {
  const disco = new Map<string, Rec>();
  const conflitos: { id: string; origem: string; vaiDescer: boolean }[] = [];
  const idas: { updatedAt: number; base: number | null }[] = [];
  let copiaDoServidor: Rec | null = null;
  let resposta: "ok" | "desatualizada" | "outra" = "outra";
  const ganchos: GanchosDaGravacao<Rec> = {
    lerVersaoNoDisco: async (id, acimaDe) => {
      const v = disco.get(id)?.updatedAt ?? null;
      return v !== null && v > acimaDe ? v : null;
    },
    gravarNoDisco: async (rec) => {
      disco.set(rec.id, rec);
    },
    depoisDoDisco: () => {},
    enviarAoServidor: async (rec, base) => {
      idas.push({ updatedAt: rec.updatedAt, base });
      return resposta;
    },
    lerDoServidor: async () => copiaDoServidor,
    aoConflito: (id, origem, vaiDescer) => {
      conflitos.push({ id, origem, vaiDescer });
    },
  };
  return {
    disco,
    conflitos,
    idas,
    ganchos,
    servidorGuarda: (rec: Rec) => {
      copiaDoServidor = rec;
    },
    responder: (r: typeof resposta) => {
      resposta = r;
    },
  };
}

function filaQuieta() {
  return criarFilaDeGravacao<Rec>({ registrarFalha: () => {} });
}

await test("c3: a aba parada confere antes do primeiro gesto e trava como num 409, sem ter gravado nada", async () => {
  const m = mundo();
  const fila = filaQuieta();
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  fila.abrir("A", 1000);
  // A outra aba auditou: o servidor (e o disco) têm o parecer.
  const parecer = { id: "A", updatedAt: 2000, texto: "parecer" };
  m.servidorGuarda(parecer);
  m.disco.set("A", parecer);

  const pode = fila.conferirAntesDeGastar(
    "A",
    { estado: "lida", guardada: 2000 },
    m.ganchos,
  );
  assert.equal(pode, false, "a aba parada gastaria");
  assert.equal(fila.travada("A"), "servidor");
  assert.deepEqual(m.conflitos, [
    { id: "A", origem: "servidor", vaiDescer: true },
  ]);
  assert.equal(m.idas.length, 0, "conferir não é gravar");
  await fila.ociosa();
  await microtarefas();
  assert.equal(m.disco.get("A")?.texto, "parecer");

  // E a trava vale para o que vier: a gravação seguinte nem sai.
  await fila.gravar({ id: "A", updatedAt: 3000, texto: "oi" }, m.ganchos);
  assert.equal(m.idas.length, 0);
  assert.equal(
    fila.conferirAntesDeGastar(
      "A",
      { estado: "lida", guardada: 2000 },
      m.ganchos,
    ),
    false,
  );
  assert.equal(m.conflitos.length, 1, "a trava já acesa não avisa de novo");
});

await test("base não conferida e servidor mais novo: trava, mas não desce a cópia do servidor por cima do disco", async () => {
  const m = mundo();
  const fila = filaQuieta();
  m.disco.set("A", {
    id: "A",
    updatedAt: 1000,
    texto: "edições desta máquina",
  });
  fila.abrir("A", 1000, { verificada: false });
  m.servidorGuarda({ id: "A", updatedAt: 2000, texto: "servidor" });

  assert.equal(
    fila.conferirAntesDeGastar(
      "A",
      { estado: "lida", guardada: 2000 },
      m.ganchos,
    ),
    false,
  );
  assert.deepEqual(m.conflitos, [
    { id: "A", origem: "servidor", vaiDescer: false },
  ]);
  await fila.ociosa();
  await microtarefas();
  assert.equal(m.disco.get("A")?.texto, "edições desta máquina");
});

await test("servidor fora do alcance: deixa gastar e a base segue não conferida (um 409 depois não desce nada)", async () => {
  const m = mundo();
  const fila = filaQuieta();
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "edições" });
  fila.abrir("A", 1000, { verificada: false });
  assert.equal(
    fila.conferirAntesDeGastar("A", { estado: "inalcancavel" }, m.ganchos),
    true,
  );
  assert.equal(fila.travada("A"), null);

  m.responder("desatualizada");
  await fila.gravar(
    { id: "A", updatedAt: 3000, texto: "edições 2" },
    m.ganchos,
  );
  await microtarefas();
  assert.deepEqual(m.conflitos.at(-1), {
    id: "A",
    origem: "servidor",
    vaiDescer: false,
  });
});

await test("em dia com o servidor: deixa gastar e confere a base (um 409 depois é de verdade e desce a cópia)", async () => {
  const m = mundo();
  const fila = filaQuieta();
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  fila.abrir("A", 1000, { verificada: false });
  assert.equal(
    fila.conferirAntesDeGastar(
      "A",
      { estado: "lida", guardada: 1000 },
      m.ganchos,
    ),
    true,
  );

  m.responder("desatualizada");
  await fila.gravar({ id: "A", updatedAt: 3000, texto: "oi" }, m.ganchos);
  await microtarefas();
  assert.deepEqual(m.conflitos.at(-1), {
    id: "A",
    origem: "servidor",
    vaiDescer: true,
  });
});

await test("a versão do servidor é uma gravação desta aba ainda sem resposta: deixa gastar", async () => {
  const m = mundo();
  const fila = filaQuieta();
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  fila.abrir("A", 1000);
  // A ida sai e fica sem resposta ("outra"): a versão 3000 é própria.
  const gravando = fila.gravar(
    { id: "A", updatedAt: 3000, texto: "bilhete" },
    m.ganchos,
  );
  assert.equal(
    fila.conferirAntesDeGastar(
      "A",
      { estado: "lida", guardada: 3000 },
      m.ganchos,
    ),
    true,
  );
  await gravando;
  assert.equal(fila.travada("A"), null);
  assert.deepEqual(m.conflitos, []);
});

await test("conversa nova, sem base: não há o que conferir (o store nem vai à rede)", async () => {
  const m = mundo();
  const fila = filaQuieta();
  assert.equal(fila.temBase("N"), false);
  fila.abrir("A", 1000);
  assert.equal(fila.temBase("A"), true);
  // A primeira gravação da conversa nova, aceita pelo disco, vira a base.
  await fila.gravar({ id: "N", updatedAt: 500, texto: "primeira" }, m.ganchos);
  assert.equal(fila.temBase("N"), true);
});

console.log(`\n${passed} ok`);
