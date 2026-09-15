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
    lerVersaoNoDisco: async (id) => {
      leituras++;
      return disco.get(id)?.updatedAt ?? null;
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
    },
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

console.log(`\n${passed} ok`);
