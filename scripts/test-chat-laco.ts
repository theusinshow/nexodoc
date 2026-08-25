/**
 * O LAÇO DESPACHA, PARA NO TETO, E NUNCA SILENCIA.
 *
 * O executor do modelo é INJETADO: nenhum token é gasto aqui. É o que permite
 * testar o que mais importa — que um modelo em laço não deixe o engenheiro sem
 * resposta nenhuma, e que evidência inventada não chegue ao parecer.
 *
 *   node scripts/test-chat-laco.ts  (== npm run test:chat:laco)
 */
import assert from "node:assert/strict";

import { montarContexto } from "../server/audit/chat/ferramentas.ts";
import { runChatTurn, tetoDeVoltas } from "../server/audit/chat/run-chat-turn.ts";

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

const memoria = {
  fileName: "m.pdf",
  paginas: [
    { page: 40, text: "1 - PAREDES\nAlvenaria em bloco ceramico de vedacao." },
    { page: 41, text: "Chapisco com argamassa de cimento e areia no traco 1:3." },
  ],
  capitulos: [{ id: "chunk-1", title: "1 - PAREDES", startPage: 40, endPage: 41, chars: 100 }],
  charCount: 100,
};

const reportBase = {
  arquivo: "m.pdf",
  tipo_auditoria: "memorial",
  tipo_documento: "Memorial descritivo",
  status_geral: "Reprovado",
  total_incongruencias: 0,
  incongruencias: [],
};

/** Contexto novo a cada teste: o laço acrescenta o achado ao contexto do turno. */
const novoCtx = (comMemoria = true) =>
  montarContexto(
    JSON.parse(JSON.stringify(reportBase)) as never,
    comMemoria ? [JSON.parse(JSON.stringify(memoria))] : [],
  );

/** Um executor roteirizado: devolve, em ordem, as saídas que o roteiro manda. */
function roteiro(passos: { text: string; output: unknown[] }[]) {
  const vistas: { input: unknown[]; ultimaVolta: boolean }[] = [];
  let i = 0;
  const executar = (async (args: { input: unknown[]; ultimaVolta: boolean }) => {
    vistas.push({ input: args.input, ultimaVolta: args.ultimaVolta });
    const passo = passos[Math.min(i, passos.length - 1)];
    i += 1;
    return passo;
  }) as never;
  return { executar, vistas, chamadas: () => i };
}

const chamada = (call_id: string, name: string, args: Record<string, unknown>) => ({
  type: "function_call",
  call_id,
  name,
  arguments: JSON.stringify(args),
});

async function colher(gen: AsyncGenerator<{ type: string; [k: string]: unknown }>) {
  const eventos: { type: string; [k: string]: unknown }[] = [];
  for await (const e of gen) eventos.push(e);
  return eventos;
}

await test("resposta sem ferramenta sai em uma volta so", async () => {
  const r = roteiro([{ text: "O parecer reprova por 3 achados criticos.", output: [] }]);
  const eventos = await colher(
    runChatTurn({ ctx: novoCtx(), pergunta: "resuma", historico: [], executar: r.executar }),
  );
  assert.equal(r.chamadas(), 1);
  const delta = eventos.find((e) => e.type === "delta");
  assert.ok(String(delta?.text).includes("3 achados"));
  const done = eventos.find((e) => e.type === "done");
  assert.equal(done?.voltas, 1);
  assert.equal(done?.parouPorTeto, false);
});

await test("uma chamada de ferramenta vira evento e realimenta o modelo", async () => {
  const r = roteiro([
    { text: "", output: [chamada("c1", "buscar_no_memorial", { termo: "chapisco" })] },
    { text: "Esta na pagina 41.", output: [] },
  ]);
  const eventos = await colher(
    runChatTurn({
      ctx: novoCtx(),
      pergunta: "onde fala de chapisco?",
      historico: [],
      executar: r.executar,
    }),
  );
  const ferramenta = eventos.find((e) => e.type === "ferramenta");
  assert.equal(ferramenta?.nome, "buscar_no_memorial");
  assert.equal(r.chamadas(), 2);
  // A segunda volta viu o RESULTADO da ferramenta.
  const segundaEntrada = JSON.stringify(r.vistas[1].input);
  assert.ok(segundaEntrada.includes("function_call_output"), segundaEntrada.slice(0, 300));
  assert.ok(segundaEntrada.includes("41"), "o resultado da busca nao voltou pro modelo");
});

await test("ferramenta desconhecida nao derruba o turno: devolve erro ao modelo", async () => {
  const r = roteiro([
    { text: "", output: [chamada("c1", "ferramenta_que_nao_existe", {})] },
    { text: "Corrigido.", output: [] },
  ]);
  const eventos = await colher(
    runChatTurn({ ctx: novoCtx(), pergunta: "x", historico: [], executar: r.executar }),
  );
  assert.ok(eventos.some((e) => e.type === "done"));
  assert.ok(/n[aã]o existe|desconhecid/i.test(JSON.stringify(r.vistas[1].input)));
});

await test("argumento invalido (JSON quebrado) volta como erro, nao como excecao", async () => {
  const r = roteiro([
    {
      text: "",
      output: [{ type: "function_call", call_id: "c1", name: "ler_paginas", arguments: "{nao e json" }],
    },
    { text: "Ok.", output: [] },
  ]);
  const eventos = await colher(
    runChatTurn({ ctx: novoCtx(), pergunta: "x", historico: [], executar: r.executar }),
  );
  assert.ok(eventos.some((e) => e.type === "done"));
});

await test("o laco PARA no teto e DIZ que parou", async () => {
  // Um roteiro que nunca para de pedir ferramenta.
  const r = roteiro([{ text: "", output: [chamada("c1", "listar_capitulos", {})] }]);
  const eventos = await colher(
    runChatTurn({ ctx: novoCtx(), pergunta: "x", historico: [], executar: r.executar }),
  );
  const done = eventos.find((e) => e.type === "done");
  assert.equal(done?.parouPorTeto, true);
  assert.equal(done?.voltas, tetoDeVoltas());
  // A ultima chamada foi avisada de que era a ultima: sem isso o modelo pediria
  // ferramenta de novo e o engenheiro ficaria sem resposta nenhuma.
  assert.equal(r.vistas.at(-1)?.ultimaVolta, true);
  assert.ok(eventos.some((e) => e.type === "delta"), "estourou o teto e nao respondeu nada");
});

const propostaBoa = {
  pagina: "41",
  tipo: "Traco divergente",
  descricao: "O traco nao bate com a norma.",
  evidencia: 'Pagina 41: "argamassa de cimento e areia no traco 1:3"',
  conflito: "A norma exige 1:4.",
  sugestao_correcao: "Uniformizar o traco.",
  prioridade: "Media",
  impacto: "tecnico_contratual",
};

await test("registrar_achado aceito emite o achado e avisa quem grava", async () => {
  const gravados: unknown[] = [];
  const r = roteiro([
    { text: "", output: [chamada("c1", "registrar_achado", propostaBoa)] },
    { text: "Registrei como INC-001.", output: [] },
  ]);
  const eventos = await colher(
    runChatTurn({
      ctx: novoCtx(),
      pergunta: "achou algo?",
      historico: [],
      executar: r.executar,
      aoRegistrar: (a) => {
        gravados.push(a);
      },
    }),
  );
  const achado = eventos.find((e) => e.type === "achado");
  assert.ok(achado, "nao emitiu o achado para o cliente");
  assert.equal(gravados.length, 1);
});

await test("registrar_achado com evidencia inventada NAO grava e ensina o modelo", async () => {
  const gravados: unknown[] = [];
  const r = roteiro([
    {
      text: "",
      output: [
        chamada("c1", "registrar_achado", {
          ...propostaBoa,
          tipo: "Defeito imaginario",
          evidencia: 'Pagina 41: "manta asfaltica de quatro milimetros"',
        }),
      ],
    },
    { text: "Nao consegui sustentar; retiro.", output: [] },
  ]);
  const eventos = await colher(
    runChatTurn({
      ctx: novoCtx(),
      pergunta: "achou algo?",
      historico: [],
      executar: r.executar,
      aoRegistrar: (a) => {
        gravados.push(a);
      },
    }),
  );
  assert.equal(gravados.length, 0, "gravou achado com evidencia inventada");
  assert.ok(!eventos.some((e) => e.type === "achado"));
  assert.ok(/n[aã]o foi encontrad|n[aã]o existe/i.test(JSON.stringify(r.vistas[1].input)));
});

await test("sem memoria do documento, o turno avisa e ainda responde", async () => {
  const r = roteiro([{ text: "Nao tenho o documento desta auditoria.", output: [] }]);
  const eventos = await colher(
    runChatTurn({
      ctx: novoCtx(false),
      pergunta: "leia a pagina 41",
      historico: [],
      executar: r.executar,
    }),
  );
  // A instrucao do modo degradado tem de chegar ao modelo na PRIMEIRA volta.
  assert.ok(/DEGRADADO|reaudit/i.test(JSON.stringify(r.vistas[0].input)));
  assert.ok(eventos.some((e) => e.type === "delta"));
});

console.log(`\n${passed} teste(s) do laco do chat OK`);
