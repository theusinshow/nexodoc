/**
 * A ABA DESATUALIZADA NÃO GRAVA — nem na primeira gravação, nem na segunda.
 *
 * O caso medido (15/09/2026, jornada c3 da bateria, Tarefa 14): a aba 2 abriu a
 * conversa antes do parecer, a aba 1 auditou, e a aba 2 gravou depois — com
 * hora nova e conteúdo velho. O parecer sumiu do servidor e do disco que as
 * duas abas dividem.
 *
 * A primeira versão do conserto (o brief da Tarefa 15) conferia a trava e
 * avançava a base na hora de ENFILEIRAR, e só lia o disco dentro do trabalho.
 * O store grava sempre em dupla (`gravarJa`: agora e de novo no commit): a
 * primeira acha o disco mais novo e trava, mas a segunda já tinha passado pela
 * trava com a base avançada para a hora da primeira — que é mais nova que a da
 * outra aba. Ela gravava por cima do parecer e ia ao servidor com uma base que
 * não dá 409. Contra aquele desenho, o primeiro teste daqui ficou vermelho
 * ("o disco perdeu o parecer": `'oi (commit)'` no lugar de `'parecer'`).
 *
 * O servidor daqui aplica as regras da rota (`app/api/nexo/conversas/route.ts`)
 * na ordem de chegada que o teste escolher: as idas não esperam uma pela outra.
 *
 *   node scripts/test-fila-de-gravacao.ts   (== npm run test:fila-de-gravacao)
 */
import assert from "node:assert/strict";

import {
  criarFilaDeGravacao,
  type GanchosDaGravacao,
} from "../modules/nexo/lib/fila-de-gravacao.ts";
import { gravacaoDesatualizada } from "../server/nexo/conversa-remota.ts";
import { escolherCopia } from "../modules/nexo/lib/copia-mais-nova.ts";

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

type Rec = { id: string; updatedAt: number; texto: string };
type Ida = {
  id: string;
  texto: string;
  updatedAt: number;
  base: number | null;
  proprias: readonly number[];
};

/** As regras do `PUT` da rota, na ordem dela, para uma sequência de chegadas. */
function servidor(guardadaInicial: number | null, chegadas: readonly Ida[]) {
  let guardada = guardadaInicial;
  let texto: string | null = null;
  const respostas = chegadas.map((ida) => {
    if (guardada !== null && guardada > ida.updatedAt) return "ignorada";
    if (
      gravacaoDesatualizada({
        guardada,
        base: ida.base,
        proprias: ida.proprias,
      })
    )
      return "409";
    guardada = ida.updatedAt;
    texto = ida.texto;
    return "ok";
  });
  return { respostas, guardada, texto };
}

/** O disco que as abas dividem e o registro das idas ao servidor. */
function mundo() {
  const disco = new Map<string, Rec>();
  const idas: Ida[] = [];
  const conflitos: string[] = [];
  const falhasNoDisco: string[] = [];
  let discoQuebrado = false;
  let leituras = 0;
  const ganchos: GanchosDaGravacao<Rec> = {
    // Como `versaoMaisNovaNoDisco`: só devolve a versão se for mais nova.
    lerVersaoNoDisco: async (id, acimaDe) => {
      leituras++;
      const v = disco.get(id)?.updatedAt ?? null;
      return v !== null && v > acimaDe ? v : null;
    },
    gravarNoDisco: async (rec) => {
      if (discoQuebrado) throw new Error("quota estourada");
      disco.set(rec.id, rec);
    },
    depoisDoDisco: (rec, ok) => {
      if (!ok) falhasNoDisco.push(rec.texto);
    },
    enviarAoServidor: (rec, base, proprias) => {
      idas.push({
        id: rec.id,
        texto: rec.texto,
        updatedAt: rec.updatedAt,
        base,
        proprias: [...proprias],
      });
      // Sem servidor de verdade: nem confirma nem recusa.
      return Promise.resolve("outra" as const);
    },
    lerDoServidor: async () => null,
    aoConflito: (id) => {
      conflitos.push(id);
    },
  };
  return {
    disco,
    idas,
    conflitos,
    falhasNoDisco,
    ganchos,
    leituras: () => leituras,
    quebrarDisco: (sim: boolean) => {
      discoQuebrado = sim;
    },
  };
}

function filaQuieta() {
  const falhas: unknown[] = [];
  const fila = criarFilaDeGravacao<Rec>({
    registrarFalha: (e) => falhas.push(e),
  });
  return { fila, falhas };
}

await test("a aba parada grava em dupla (agora + commit): nenhuma das duas chega ao disco nem passa no servidor", async () => {
  const m = mundo();
  const { fila } = filaQuieta();
  // A aba 2 abre a conversa na versão 1000.
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  fila.abrir("A", 1000);
  // A aba 1 grava o parecer (outra fila, mesmo disco, e já no servidor).
  m.disco.set("A", { id: "A", updatedAt: 2000, texto: "parecer" });
  // A aba 2 grava já e pede outra gravação no commit — as duas na mesma volta.
  const primeira = fila.gravar(
    { id: "A", updatedAt: 3000, texto: "oi (agora)" },
    m.ganchos,
  );
  const segunda = fila.gravar(
    { id: "A", updatedAt: 3001, texto: "oi (commit)" },
    m.ganchos,
  );
  await Promise.all([primeira, segunda]);

  assert.equal(m.disco.get("A")?.texto, "parecer", "o disco perdeu o parecer");
  assert.equal(m.disco.get("A")?.updatedAt, 2000);
  assert.equal(fila.travada("A"), "disco");
  assert.ok(m.conflitos.includes("A"));
  // Nenhuma ida leva base mais nova que a leitura da aba parada...
  assert.deepEqual(
    m.idas.map((i) => i.base),
    m.idas.map(() => 1000),
  );
  // ...e o servidor, com o parecer guardado, recusa as duas em qualquer ordem.
  for (const chegadas of [m.idas, [...m.idas].reverse()]) {
    const s = servidor(2000, chegadas);
    assert.deepEqual(
      s.respostas,
      chegadas.map(() => "409"),
      `respostas=${s.respostas.join(",")} idas=${JSON.stringify(chegadas)}`,
    );
    assert.equal(s.guardada, 2000);
  }
});

await test("a gravação pedida depois da trava nem sai", async () => {
  const m = mundo();
  const { fila } = filaQuieta();
  m.disco.set("A", { id: "A", updatedAt: 2000, texto: "parecer" });
  fila.abrir("A", 1000);
  await fila.gravar({ id: "A", updatedAt: 3000, texto: "oi" }, m.ganchos);
  const idasAntes = m.idas.length;
  await fila.gravar(
    { id: "A", updatedAt: 4000, texto: "resposta da IA" },
    m.ganchos,
  );
  assert.equal(m.disco.get("A")?.texto, "parecer");
  assert.equal(m.idas.length, idasAntes);
});

await test("a aba em dia grava em dupla: as duas chegam ao disco, e o servidor aceita em qualquer ordem", async () => {
  const m = mundo();
  const { fila } = filaQuieta();
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  fila.abrir("A", 1000);
  const a = fila.gravar(
    { id: "A", updatedAt: 3000, texto: "agora" },
    m.ganchos,
  );
  const b = fila.gravar(
    { id: "A", updatedAt: 3001, texto: "commit" },
    m.ganchos,
  );
  await Promise.all([a, b]);
  assert.equal(m.disco.get("A")?.texto, "commit");
  assert.equal(fila.travada("A"), null);
  assert.deepEqual(m.conflitos, []);
  for (const chegadas of [m.idas, [...m.idas].reverse()]) {
    const s = servidor(1000, chegadas);
    assert.ok(!s.respostas.includes("409"), s.respostas.join(","));
    assert.equal(s.texto, "commit");
  }
});

await test("duas gravações no mesmo milissegundo, chegando trocadas ao servidor, não dão 409", async () => {
  // Medido em 15/09/2026 na regressão da a3: `updatedAt` igual, e a primeira
  // achava guardado IGUAL à hora dela e mais novo que a base — 409 contra a
  // própria aba, a conversa travava e o parecer da rodada 1 nunca chegava.
  const m = mundo();
  const { fila } = filaQuieta();
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  fila.abrir("A", 1000);
  const a = fila.gravar(
    { id: "A", updatedAt: 5000, texto: "agora" },
    m.ganchos,
  );
  const b = fila.gravar(
    { id: "A", updatedAt: 5000, texto: "commit" },
    m.ganchos,
  );
  await Promise.all([a, b]);
  assert.ok(m.idas[1].updatedAt > m.idas[0].updatedAt);
  const s = servidor(1000, [...m.idas].reverse());
  assert.ok(!s.respostas.includes("409"), s.respostas.join(","));
  assert.equal(m.disco.get("A")?.texto, "commit");
});

await test("a ida ao servidor sai dentro de gravar(), sem esperar fila, leitura ou disco", async () => {
  // Medido em 15/09/2026 (a1, 4 corridas): ~50ms de espera antes do `fetch`
  // deixaram o servidor com o bilhete em 3 delas quando a aba fechou.
  const m = mundo();
  const { fila } = filaQuieta();
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  fila.abrir("A", 1000);
  const primeira = fila.gravar(
    { id: "A", updatedAt: 3000, texto: "bilhete limpo" },
    m.ganchos,
  );
  const segunda = fila.gravar(
    { id: "A", updatedAt: 3100, texto: "parecer" },
    m.ganchos,
  );
  assert.equal(m.idas.length, 2, "as idas esperaram alguma coisa");
  assert.deepEqual(m.idas[1].proprias, [3000]);
  await Promise.all([primeira, segunda]);
});

await test("conversa nova: a primeira ida vai sem base e sem ler o disco; a seguinte com a base confirmada", async () => {
  const m = mundo();
  const { fila } = filaQuieta();
  await fila.gravar({ id: "N", updatedAt: 500, texto: "primeira" }, m.ganchos);
  assert.equal(m.leituras(), 0);
  await fila.gravar({ id: "N", updatedAt: 600, texto: "segunda" }, m.ganchos);
  assert.deepEqual(
    m.idas.map((i) => [i.base, i.proprias]),
    [
      [null, []],
      [500, []],
    ],
  );
});

await test("o disco falhou: a base não avança (a próxima ainda protege o que a outra aba gravar)", async () => {
  const m = mundo();
  const { fila } = filaQuieta();
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  fila.abrir("A", 1000);
  m.quebrarDisco(true);
  await fila.gravar(
    { id: "A", updatedAt: 3000, texto: "não gravou" },
    m.ganchos,
  );
  m.quebrarDisco(false);
  assert.deepEqual(m.falhasNoDisco, ["não gravou"]);
  // Outra aba grava entre a falha e a próxima gravação desta.
  m.disco.set("A", { id: "A", updatedAt: 2000, texto: "parecer" });
  await fila.gravar({ id: "A", updatedAt: 4000, texto: "oi" }, m.ganchos);
  assert.equal(m.disco.get("A")?.texto, "parecer");
  assert.equal(fila.travada("A"), "disco");
});

await test("o servidor confirmou o que o disco não gravou: a base avança", async () => {
  const m = mundo();
  const { fila } = filaQuieta();
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  fila.abrir("A", 1000);
  m.quebrarDisco(true);
  await fila.gravar(
    { id: "A", updatedAt: 3000, texto: "só no servidor" },
    m.ganchos,
  );
  m.quebrarDisco(false);
  fila.confirmar("A", 3000);
  await fila.gravar({ id: "A", updatedAt: 4000, texto: "seguinte" }, m.ganchos);
  assert.equal(m.idas.at(-1)?.base, 3000);
  assert.deepEqual(m.idas.at(-1)?.proprias, []);
});

await test("o gancho do servidor que estoura é registrado, e o disco grava e avança a base mesmo assim", async () => {
  const m = mundo();
  const { fila, falhas } = filaQuieta();
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  fila.abrir("A", 1000);
  await fila.gravar(
    { id: "A", updatedAt: 3000, texto: "gravou" },
    {
      ...m.ganchos,
      enviarAoServidor: () => {
        throw new Error("gancho quebrado");
      },
    },
  );
  assert.equal(falhas.length, 1, "a falha tem de ser registrada");
  await fila.gravar({ id: "A", updatedAt: 4000, texto: "seguinte" }, m.ganchos);
  assert.equal(m.disco.get("A")?.texto, "seguinte");
  assert.equal(fila.travada("A"), null);
});

await test("um trabalho que estoura não trava a fila: a gravação seguinte chega", async () => {
  const m = mundo();
  const { fila, falhas } = filaQuieta();
  await fila.gravar(
    { id: "A", updatedAt: 1000, texto: "estoura" },
    {
      ...m.ganchos,
      depoisDoDisco: () => {
        throw new Error("gancho quebrado");
      },
    },
  );
  await fila.gravar({ id: "A", updatedAt: 2000, texto: "chega" }, m.ganchos);
  assert.equal(m.disco.get("A")?.texto, "chega");
  assert.equal(falhas.length, 1, "a falha tem de ser registrada, não engolida");
});

await test("recarregar destrava, e o que estava na fila da tela velha é largado", async () => {
  const m = mundo();
  const { fila } = filaQuieta();
  m.disco.set("A", { id: "A", updatedAt: 2000, texto: "parecer" });
  fila.abrir("A", 1000);
  fila.abrir("B", 100);
  // Na fila: a gravação de A que vai travar, uma de B que demora a ler o
  // disco, e atrás dela outra de A — enfileirada ANTES de a trava acontecer.
  let soltar: (() => void) | null = null;
  const lento: GanchosDaGravacao<Rec> = {
    ...m.ganchos,
    lerVersaoNoDisco: (id) =>
      new Promise((resolve) => {
        soltar = () => resolve(m.disco.get(id)?.updatedAt ?? null);
      }),
  };
  const trava = fila.gravar(
    { id: "A", updatedAt: 3000, texto: "oi" },
    m.ganchos,
  );
  const daFrente = fila.gravar(
    { id: "B", updatedAt: 3400, texto: "outra" },
    lento,
  );
  const velha = fila.gravar(
    { id: "A", updatedAt: 3500, texto: "tela velha" },
    m.ganchos,
  );
  await trava;
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(fila.travada("A"), "disco");
  // Recarregou antes de a gravação velha executar: a base agora é a lida.
  fila.abrir("A", 2000);
  assert.ok(soltar, "a gravação de B devia estar esperando o disco");
  (soltar as () => void)();
  await Promise.all([daFrente, velha]);
  assert.equal(
    m.disco.get("A")?.texto,
    "parecer",
    "a tela velha gravou depois de recarregar",
  );
  assert.equal(fila.travada("A"), null);
  // A tela recarregada grava normalmente.
  await fila.gravar(
    { id: "A", updatedAt: 5000, texto: "depois de recarregar" },
    m.ganchos,
  );
  assert.equal(m.disco.get("A")?.texto, "depois de recarregar");
  assert.equal(m.idas.at(-1)?.base, 2000);
});

await test("o servidor travou (outra máquina): a fila para de gravar esta conversa", async () => {
  const m = mundo();
  const { fila } = filaQuieta();
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  fila.abrir("A", 1000);
  fila.travar("A", "servidor");
  await fila.gravar({ id: "A", updatedAt: 3000, texto: "oi" }, m.ganchos);
  assert.equal(m.disco.get("A")?.texto, "leitura");
  assert.deepEqual(m.idas, []);
  assert.equal(fila.travada("A"), "servidor");
});

await test("o 409 que chega com o trabalho ainda na fila impede a gravação no disco", async () => {
  const m = mundo();
  const { fila } = filaQuieta();
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  fila.abrir("A", 1000);
  const gravando = fila.gravar(
    { id: "A", updatedAt: 3000, texto: "de uma tela velha" },
    m.ganchos,
  );
  // A resposta do servidor chega antes de o trabalho do disco rodar.
  fila.travar("A", "servidor");
  await gravando;
  assert.equal(m.disco.get("A")?.texto, "leitura");
});

await test("reabrir em dia não recua a base para trás de uma gravação desta aba que chegou depois da leitura", async () => {
  const m = mundo();
  const { fila } = filaQuieta();
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  fila.abrir("A", 1000);
  await fila.gravar({ id: "A", updatedAt: 3000, texto: "minha" }, m.ganchos);
  // A reabertura leu o disco ANTES de a gravação acima chegar (versão 1000).
  fila.abrir("A", 1000);
  await fila.gravar({ id: "A", updatedAt: 4000, texto: "seguinte" }, m.ganchos);
  assert.equal(
    m.disco.get("A")?.texto,
    "seguinte",
    "trava falsa contra a própria aba",
  );
  assert.equal(fila.travada("A"), null);
});

await test("a trava de uma conversa não segura as outras", async () => {
  const m = mundo();
  const { fila } = filaQuieta();
  m.disco.set("A", { id: "A", updatedAt: 2000, texto: "parecer" });
  fila.abrir("A", 1000);
  await fila.gravar({ id: "A", updatedAt: 3000, texto: "oi" }, m.ganchos);
  await fila.gravar(
    { id: "B", updatedAt: 3100, texto: "outra conversa" },
    m.ganchos,
  );
  assert.equal(m.disco.get("B")?.texto, "outra conversa");
  assert.equal(fila.travada("B"), null);
});

await test("ociosa() só resolve depois de o último trabalho terminar", async () => {
  const m = mundo();
  const { fila } = filaQuieta();
  void fila.gravar({ id: "A", updatedAt: 1000, texto: "um" }, m.ganchos);
  void fila.gravar({ id: "A", updatedAt: 2000, texto: "dois" }, m.ganchos);
  await fila.ociosa();
  assert.equal(m.disco.get("A")?.texto, "dois");
});

/*
 * A RECUSA VINDA DO SERVIDOR (revisão da Tarefa 15, 15/09/2026). Quem gravou
 * antes foi OUTRA MÁQUINA: o disco desta não tem versão mais nova, a checagem
 * do disco passa, e a gravação parada chega ao disco centenas de ms antes do
 * 409. A trava morava só na memória: um F5 reabria do disco (a cópia parada,
 * com hora mais nova que a do servidor), ela virava a base, e a gravação
 * seguinte passava na rota e apagava o trabalho da outra máquina.
 */

/** Um servidor com as regras da rota, que responde depois de `latenciaMs`. */
function servidorVivo(inicial: Rec, latenciaMs = 5) {
  const estado = { atual: inicial };
  const ganchos = (
    m: ReturnType<typeof mundo>,
  ): Pick<GanchosDaGravacao<Rec>, "enviarAoServidor" | "lerDoServidor"> => ({
    enviarAoServidor: (rec, base, proprias) =>
      new Promise((resolve) =>
        setTimeout(() => {
          const s = servidor(estado.atual.updatedAt, [
            {
              id: rec.id,
              texto: rec.texto,
              updatedAt: rec.updatedAt,
              base,
              proprias,
            },
          ]);
          if (s.respostas[0] === "ok") estado.atual = rec;
          m.idas.push({
            id: rec.id,
            texto: rec.texto,
            updatedAt: rec.updatedAt,
            base,
            proprias: [...proprias],
          });
          resolve(
            s.respostas[0] === "409"
              ? "desatualizada"
              : s.respostas[0] === "ok"
                ? "ok"
                : "outra",
          );
        }, latenciaMs),
      ),
    lerDoServidor: async () => estado.atual,
  });
  return { estado, ganchos };
}

async function assentar(fila: { ociosa: () => Promise<void> }) {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 20));
    await fila.ociosa();
  }
}

await test("409 do servidor depois de o disco gravar: o F5 que reabre do disco não apaga a outra máquina", async () => {
  const m = mundo();
  const srv = servidorVivo({
    id: "A",
    updatedAt: 2500,
    texto: "trabalho da outra máquina",
  });
  const ganchos = { ...m.ganchos, ...srv.ganchos(m) };
  // Esta máquina abriu A na versão 1000; a outra gravou 2500 só no servidor.
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  const fila = criarFilaDeGravacao<Rec>({ registrarFalha: () => {} });
  fila.abrir("A", 1000);
  await fila.gravar({ id: "A", updatedAt: 3000, texto: "parada" }, ganchos);
  await assentar(fila);
  const travadaAntesDoF5 = fila.travada("A");

  // F5: fila nova, reabre pela regra do store (a cópia de hora mais nova).
  const doDisco = m.disco.get("A")!;
  const aberta =
    doDisco.updatedAt >= srv.estado.atual.updatedAt
      ? doDisco
      : srv.estado.atual;
  const depoisDoF5 = criarFilaDeGravacao<Rec>({ registrarFalha: () => {} });
  depoisDoF5.abrir("A", aberta.updatedAt);
  await depoisDoF5.gravar(
    { id: "A", updatedAt: 4000, texto: `${aberta.texto} + edição` },
    ganchos,
  );
  await assentar(depoisDoF5);

  assert.ok(
    srv.estado.atual.texto.includes("trabalho da outra máquina"),
    `o servidor perdeu o trabalho da outra máquina: "${srv.estado.atual.texto}" (disco depois do 409: "${doDisco.texto}")`,
  );
  assert.equal(travadaAntesDoF5, "servidor");
});

await test("409 atrasado de uma gravação de antes da recarga não trava de novo a conversa recarregada", async () => {
  const m = mundo();
  const fila = criarFilaDeGravacao<Rec>({ registrarFalha: () => {} });
  m.disco.set("A", { id: "A", updatedAt: 2000, texto: "parecer" });
  fila.abrir("A", 1000);
  let responder: ((r: "desatualizada") => void) | null = null;
  const lento: GanchosDaGravacao<Rec> = {
    ...m.ganchos,
    enviarAoServidor: () => new Promise((resolve) => (responder = resolve)),
    lerDoServidor: async () => ({
      id: "A",
      updatedAt: 1500,
      texto: "cópia velha do servidor",
    }),
  };
  await fila.gravar({ id: "A", updatedAt: 3000, texto: "oi" }, lento);
  assert.equal(fila.travada("A"), "disco");
  const conflitosAntes = m.conflitos.length;
  // Recarregou; só então chega o 409 da gravação de antes.
  fila.abrir("A", 2000);
  assert.ok(responder, "a ida devia estar esperando a resposta");
  (responder as (r: "desatualizada") => void)("desatualizada");
  await assentar(fila);
  assert.equal(
    fila.travada("A"),
    null,
    "a resposta velha travou a conversa recarregada",
  );
  assert.equal(m.conflitos.length, conflitosAntes);
  assert.equal(
    m.disco.get("A")?.texto,
    "parecer",
    "a resposta velha desceu a cópia do servidor",
  );
});

await test("409 com o disco travado por outra aba local: a cópia do servidor NÃO desce por cima do disco dela", async () => {
  const m = mundo();
  const srv = servidorVivo({
    id: "A",
    updatedAt: 1800,
    texto: "servidor atrasado",
  });
  const ganchos = { ...m.ganchos, ...srv.ganchos(m) };
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  const fila = criarFilaDeGravacao<Rec>({ registrarFalha: () => {} });
  fila.abrir("A", 1000);
  // A outra aba local gravou o disco (2000) e o servidor ainda tem 1800.
  m.disco.set("A", { id: "A", updatedAt: 2000, texto: "outra aba local" });
  await fila.gravar({ id: "A", updatedAt: 3000, texto: "parada" }, ganchos);
  await assentar(fila);
  assert.equal(m.disco.get("A")?.texto, "outra aba local");
});

await test("409 que chega depois de outra aba local gravar o disco: a cópia do servidor não desce por cima", async () => {
  const m = mundo();
  const srv = servidorVivo(
    { id: "A", updatedAt: 2500, texto: "outra máquina" },
    30,
  );
  const ganchos = { ...m.ganchos, ...srv.ganchos(m) };
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  const fila = criarFilaDeGravacao<Rec>({ registrarFalha: () => {} });
  fila.abrir("A", 1000);
  await fila.gravar({ id: "A", updatedAt: 3000, texto: "parada" }, ganchos);
  assert.equal(m.disco.get("A")?.texto, "parada");
  // Antes do 409: outra aba local grava o disco por cima desta.
  m.disco.set("A", { id: "A", updatedAt: 3500, texto: "outra aba local" });
  await assentar(fila);
  assert.equal(fila.travada("A"), "servidor");
  assert.equal(m.disco.get("A")?.texto, "outra aba local");
});

await test("recarregar enquanto a cópia do servidor ainda desce: a cópia velha não pousa por cima da recarga", async () => {
  const m = mundo();
  const srv = servidorVivo({
    id: "A",
    updatedAt: 2500,
    texto: "outra máquina",
  });
  let soltarLeitura: (() => void) | null = null;
  const ganchos: GanchosDaGravacao<Rec> = {
    ...m.ganchos,
    ...srv.ganchos(m),
    lerDoServidor: () =>
      new Promise((resolve) => {
        soltarLeitura = () =>
          resolve({ id: "A", updatedAt: 2500, texto: "cópia lenta" });
      }),
  };
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  const fila = criarFilaDeGravacao<Rec>({ registrarFalha: () => {} });
  fila.abrir("A", 1000);
  await fila.gravar({ id: "A", updatedAt: 3000, texto: "parada" }, ganchos);
  for (let i = 0; i < 10 && !soltarLeitura; i++)
    await new Promise((r) => setTimeout(r, 10));
  assert.ok(soltarLeitura, "a descida devia estar lendo o servidor");
  // A recarga leu e gravou por conta própria uma versão mais nova.
  m.disco.set("A", { id: "A", updatedAt: 2600, texto: "recarregada" });
  fila.abrir("A", 2600);
  (soltarLeitura as () => void)();
  await assentar(fila);
  assert.equal(m.disco.get("A")?.texto, "recarregada");
});

await test("a leitura do disco que falha é registrada (e não some calada)", async () => {
  const m = mundo();
  const falhas: unknown[] = [];
  const fila = criarFilaDeGravacao<Rec>({
    registrarFalha: (e) => falhas.push(e),
  });
  fila.abrir("A", 1000);
  await fila.gravar(
    { id: "A", updatedAt: 3000, texto: "oi" },
    {
      ...m.ganchos,
      lerVersaoNoDisco: async () => Promise.reject(new Error("IDB fechado")),
    },
  );
  assert.equal(falhas.length, 1);
});

/*
 * O 409 FALSO CONTRA A PRÓPRIA GRAVAÇÃO ATRASADA (segunda revisão da Tarefa 15,
 * 15/09/2026). A reabertura do F5 roda um quadro depois da montagem, antes de a
 * lista do servidor chegar, e abria sempre do DISCO. Se a última gravação desta
 * aba chegou ao servidor e não ao disco, a base ficava atrás do servidor; a
 * gravação seguinte (que já tinha pousado no disco) levava 409, e a descida da
 * cópia do servidor apagava do disco as edições feitas depois do F5.
 */

await test("base aberta sem conferir o servidor: 409 trava, mas NÃO desce a cópia por cima das edições locais", async () => {
  const m = mundo();
  const srv = servidorVivo({
    id: "A",
    updatedAt: 2000,
    texto: "D + W1 (minha, só no servidor)",
  });
  const ganchos = { ...m.ganchos, ...srv.ganchos(m) };
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "D" });
  const fila = criarFilaDeGravacao<Rec>({ registrarFalha: () => {} });
  // O F5 abriu do disco sem saber a versão do servidor.
  fila.abrir("A", 1000, { verificada: false });
  await fila.gravar(
    { id: "A", updatedAt: 3000, texto: "D + edições depois do F5" },
    ganchos,
  );
  await assentar(fila);
  assert.equal(
    m.disco.get("A")?.texto,
    "D + edições depois do F5",
    "a descida apagou as edições locais",
  );
  assert.equal(fila.travada("A"), "servidor");
  assert.ok(m.conflitos.includes("A"), "a trava tem de acender a faixa");
});

await test("base aberta da cópia mais nova (servidor conhecido): a própria gravação atrasada não dá 409", async () => {
  const m = mundo();
  const srv = servidorVivo({
    id: "A",
    updatedAt: 2000,
    texto: "D + W1 (minha, só no servidor)",
  });
  const ganchos = { ...m.ganchos, ...srv.ganchos(m) };
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "D" });
  // A regra da abertura (`escolherCopia`) com a versão do servidor em mãos.
  const doDisco = m.disco.get("A")!;
  const aberta =
    escolherCopia(doDisco, srv.estado.atual) === "servidor"
      ? srv.estado.atual
      : doDisco;
  const fila = criarFilaDeGravacao<Rec>({ registrarFalha: () => {} });
  fila.abrir("A", aberta.updatedAt);
  await fila.gravar(
    { id: "A", updatedAt: 3000, texto: `${aberta.texto} + edição` },
    ganchos,
  );
  await assentar(fila);
  assert.equal(fila.travada("A"), null);
  assert.ok(srv.estado.atual.texto.includes("W1"));
  assert.ok(srv.estado.atual.texto.includes("edição"));
  assert.equal(m.disco.get("A")?.texto, srv.estado.atual.texto);
});

await test("base não conferida que o servidor aceita vira conferida: o 409 de outra máquina depois disso desce a cópia", async () => {
  const m = mundo();
  const srv = servidorVivo({ id: "A", updatedAt: 1000, texto: "D" });
  const ganchos = { ...m.ganchos, ...srv.ganchos(m) };
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "D" });
  const fila = criarFilaDeGravacao<Rec>({ registrarFalha: () => {} });
  fila.abrir("A", 1000, { verificada: false });
  await fila.gravar({ id: "A", updatedAt: 2000, texto: "D + minha" }, ganchos);
  await assentar(fila);
  assert.equal(srv.estado.atual.texto, "D + minha");
  // Outra máquina grava depois; esta aba grava de novo com a base 2000.
  srv.estado.atual = { id: "A", updatedAt: 2500, texto: "outra máquina" };
  await fila.gravar({ id: "A", updatedAt: 3000, texto: "parada" }, ganchos);
  await assentar(fila);
  assert.equal(fila.travada("A"), "servidor");
  assert.equal(m.disco.get("A")?.texto, "outra máquina");
});

await test("descida: outra aba local grava o disco enquanto a cópia do servidor é lida — a cópia não pousa", async () => {
  const m = mundo();
  const srv = servidorVivo({
    id: "A",
    updatedAt: 2500,
    texto: "outra máquina",
  });
  let soltarLeitura: (() => void) | null = null;
  const ganchos: GanchosDaGravacao<Rec> = {
    ...m.ganchos,
    ...srv.ganchos(m),
    lerDoServidor: () =>
      new Promise((resolve) => {
        soltarLeitura = () => resolve(srv.estado.atual);
      }),
  };
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  const fila = criarFilaDeGravacao<Rec>({ registrarFalha: () => {} });
  fila.abrir("A", 1000);
  await fila.gravar({ id: "A", updatedAt: 3000, texto: "parada" }, ganchos);
  for (let i = 0; i < 10 && !soltarLeitura; i++)
    await new Promise((r) => setTimeout(r, 10));
  assert.ok(soltarLeitura, "a descida devia estar lendo o servidor");
  m.disco.set("A", { id: "A", updatedAt: 3500, texto: "outra aba local" });
  (soltarLeitura as () => void)();
  await assentar(fila);
  assert.equal(m.disco.get("A")?.texto, "outra aba local");
});

await test("descida: a leitura do disco que falha NÃO deixa a cópia descer às cegas", async () => {
  const m = mundo();
  const srv = servidorVivo({
    id: "A",
    updatedAt: 2500,
    texto: "outra máquina",
  });
  let quebrar = false;
  const ganchos: GanchosDaGravacao<Rec> = {
    ...m.ganchos,
    ...srv.ganchos(m),
    lerVersaoNoDisco: (id, acimaDe) =>
      quebrar
        ? Promise.reject(new Error("IDB fechado"))
        : m.ganchos.lerVersaoNoDisco(id, acimaDe),
  };
  m.disco.set("A", { id: "A", updatedAt: 1000, texto: "leitura" });
  const fila = criarFilaDeGravacao<Rec>({ registrarFalha: () => {} });
  fila.abrir("A", 1000);
  await fila.gravar({ id: "A", updatedAt: 3000, texto: "parada" }, ganchos);
  quebrar = true;
  await assentar(fila);
  assert.equal(fila.travada("A"), "servidor");
  assert.equal(m.disco.get("A")?.texto, "parada");
});

console.log(`\n${passed} ok`);
