/**
 * Trava a TABELA DE TRANSIÇÕES e as GUARDAS do reducer da sessão do Nexo (§2 da
 * ARQUITETURA.md). O reducer é PURO (sem IO, sem React), então roda direto no
 * Node com type-stripping nativo:
 *
 *   node scripts/test-nexo-session.ts   (== npm run test:nexo:session)
 *
 * Cobre: início da conversa, spawn/replace com dedup por id cunhado, criação de
 * novo id sobre trabalho pronto, a guarda de pré-condição do volume (ilegal sem
 * capa+separatriz+LD ready) e o ciclo generate→ready.
 */
import assert from "node:assert/strict";

import {
  removerResultado,
  tomoDoArtefato,
  agruparPorTomo,
} from "../modules/nexo/lib/results.ts";
import {
  descreverMudanca,
  orfaosAposDivisao,
} from "../modules/nexo/lib/edicao.ts";

import {
  initNexoSession,
  mintArtifactId,
  nexoSessionReducer,
  type NexoSession,
  type NexoSessionEvent,
} from "../modules/nexo/state/session-reducer.ts";
import type {
  NexoAgentProposal,
  NexoAgentTurn,
  NexoArtifact,
  NexoDossie,
} from "../modules/nexo/types.ts";

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

/** Reduz uma sequência de eventos a partir do estado inicial (ou de um dado). */
function run(events: NexoSessionEvent[], from?: NexoSession): NexoSession {
  return events.reduce(nexoSessionReducer, from ?? initNexoSession());
}

/** Dossiê com código/revisão/disciplina fixos — controla o id cunhado. */
function dossieFixo(): NexoDossie {
  return {
    id: "d1",
    codigo: { value: "ABC-100", origem: "usuario", confirmado: true },
    revisao: { value: "0", origem: "usuario", confirmado: true },
    disciplinas: ["estrutural"],
    arquivos: [],
    artefatos: [],
  };
}

/** Estado já com o dossiê fixo aplicado (via INTAKE_CLASSIFIED). */
function comDossie(): NexoSession {
  return run([{ type: "INTAKE_CLASSIFIED", dossie: dossieFixo() }]);
}

const ldProposal: NexoAgentProposal = {
  kind: "ld",
  resumo: "LD estrutural, 42 folhas",
  params: { tituloLd: "PROJETO ESTRUTURAL", numTomos: 1 },
};

function turn(proposals: NexoAgentProposal[], reply = "ok"): NexoAgentTurn {
  return { reply, proposals };
}

/** Move um artefato existente até `ready` (request + succeeded). */
function readyArtifact(state: NexoSession, id: string, result: unknown): NexoSession {
  return run(
    [
      { type: "ARTIFACT_GENERATE_REQUESTED", id },
      { type: "ARTIFACT_GENERATE_SUCCEEDED", id, result },
    ],
    state,
  );
}

// (a) USER_SUBMITTED_MESSAGE -> started + append
test("(a) USER_SUBMITTED_MESSAGE vira started:true e faz append da mensagem", () => {
  const s = run([{ type: "USER_SUBMITTED_MESSAGE", id: "m1", content: "oi" }]);
  assert.equal(s.started, true);
  assert.equal(s.messages.length, 1);
  assert.deepEqual(
    { id: s.messages[0].id, role: s.messages[0].role, content: s.messages[0].content },
    { id: "m1", role: "user", content: "oi" },
  );
});

// mintArtifactId é determinístico e normalizado
test("mintArtifactId cunha id normalizado e estável", () => {
  const id = mintArtifactId({
    kind: "ld",
    codigo: " ABC-100 ",
    revisao: "0",
    disciplinaKey: "Estrutural",
  });
  assert.equal(id, "ld:abc-100:0:estrutural");
});

// (b) AGENT_TURN_SUCCEEDED spawna artifact proposed com id cunhado
test("(b) AGENT_TURN_SUCCEEDED spawna artefato proposed com id cunhado", () => {
  const s = run(
    [{ type: "AGENT_TURN_SUCCEEDED", messageId: "a1", turn: turn([ldProposal]) }],
    comDossie(),
  );
  const id = mintArtifactId({
    kind: "ld",
    codigo: "ABC-100",
    revisao: "0",
    disciplinaKey: "estrutural",
  });
  const art = s.artifacts[id];
  assert.ok(art, "esperava um artefato no id cunhado");
  assert.equal(art.status, "proposed");
  assert.equal(art.messageId, "a1");
  assert.equal(s.activeArtifactId, id);
  assert.equal(Object.keys(s.artifacts).length, 1);
  // A mensagem do assistente carrega a proposta.
  assert.equal(s.messages.at(-1)?.proposals?.length, 1);
});

// (c) segundo turno com mesma proposal em proposed ATUALIZA params (mesmo id)
test("(c) proposta repetida em proposed ATUALIZA params no mesmo id", () => {
  const s1 = run(
    [{ type: "AGENT_TURN_SUCCEEDED", messageId: "a1", turn: turn([ldProposal]) }],
    comDossie(),
  );
  const refinada: NexoAgentProposal = {
    kind: "ld",
    resumo: "LD estrutural, 2 tomos",
    params: { tituloLd: "BLOCO B", numTomos: 2 },
  };
  const s2 = run(
    [{ type: "AGENT_TURN_SUCCEEDED", messageId: "a2", turn: turn([refinada]) }],
    s1,
  );
  assert.equal(Object.keys(s2.artifacts).length, 1, "sem id novo: mesmo artefato");
  const id = mintArtifactId({
    kind: "ld",
    codigo: "ABC-100",
    revisao: "0",
    disciplinaKey: "estrutural",
  });
  const art = s2.artifacts[id] as Extract<NexoArtifact, { status: "proposed" }>;
  assert.equal(art.status, "proposed");
  assert.deepEqual(art.params, { tituloLd: "BLOCO B", numTomos: 2 });
});

// (d) proposta após ready cria id NOVO (não sobrescreve)
test("(d) proposta após ready cria id NOVO, não sobrescreve o pronto", () => {
  const s1 = run(
    [{ type: "AGENT_TURN_SUCCEEDED", messageId: "a1", turn: turn([ldProposal]) }],
    comDossie(),
  );
  const baseId = mintArtifactId({
    kind: "ld",
    codigo: "ABC-100",
    revisao: "0",
    disciplinaKey: "estrutural",
  });
  const s2 = readyArtifact(s1, baseId, { pdf: "b64" });
  assert.equal(s2.artifacts[baseId].status, "ready");

  const s3 = run(
    [{ type: "AGENT_TURN_SUCCEEDED", messageId: "a3", turn: turn([ldProposal]) }],
    s2,
  );
  assert.equal(Object.keys(s3.artifacts).length, 2, "esperava um id novo");
  assert.equal(s3.artifacts[baseId].status, "ready", "o pronto ficou intacto");
  const novo = s3.artifacts[`${baseId}#2`];
  assert.ok(novo, "esperava o id sufixado #2");
  assert.equal(novo.status, "proposed");
  assert.equal(s3.activeArtifactId, `${baseId}#2`);
});

/** Prepara um estado com capa, separatriz, LD e um volume proposto. */
function comPartes(opts: { partesReady: boolean }): {
  state: NexoSession;
  volumeId: string;
} {
  const kinds: NexoAgentProposal[] = [
    { kind: "capa", resumo: "capa", params: { templateId: "t1", volume: "1", numTomos: 1 } },
    { kind: "separatriz", resumo: "sep", params: { templateId: "t1", numTomos: 1 } },
    ldProposal,
    { kind: "volume", resumo: "volume", params: {} },
  ];
  let state = run(
    [{ type: "AGENT_TURN_SUCCEEDED", messageId: "a1", turn: turn(kinds) }],
    comDossie(),
  );
  const idOf = (kind: NexoAgentProposal["kind"]) =>
    mintArtifactId({ kind, codigo: "ABC-100", revisao: "0", disciplinaKey: "estrutural" });
  if (opts.partesReady) {
    for (const kind of ["capa", "separatriz", "ld"] as const) {
      state = readyArtifact(state, idOf(kind), { pdf: kind });
    }
  }
  return { state, volumeId: idOf("volume") };
}

// (e) ARTIFACT_GENERATE_REQUESTED de volume SEM capa+sep+LD ready -> rejeitado
test("(e) gerar volume SEM capa+sep+LD ready é rejeitado (artefato intacto + diagnostic)", () => {
  const { state, volumeId } = comPartes({ partesReady: false });
  const s = nexoSessionReducer(state, {
    type: "ARTIFACT_GENERATE_REQUESTED",
    id: volumeId,
  });
  assert.equal(s.artifacts[volumeId].status, "proposed", "volume não pode transicionar");
  assert.equal(s.diagnostics.length, 1, "empurrou um diagnóstico");
  assert.equal(s.diagnostics[0].code, "VOLUME_PRECONDICAO");
});

// (f) com capa+sep+LD ready -> legal (proposed -> generating)
test("(f) gerar volume COM capa+sep+LD ready é legal (proposed -> generating)", () => {
  const { state, volumeId } = comPartes({ partesReady: true });
  const s = nexoSessionReducer(state, {
    type: "ARTIFACT_GENERATE_REQUESTED",
    id: volumeId,
  });
  assert.equal(s.artifacts[volumeId].status, "generating");
  assert.equal(s.diagnostics.length, 0, "sem diagnóstico: transição legal");
  assert.equal(s.activeArtifactId, volumeId);
});

// (g) ARTIFACT_GENERATE_SUCCEEDED move pra ready com result
test("(g) ARTIFACT_GENERATE_SUCCEEDED move generating -> ready com result", () => {
  const { state, volumeId } = comPartes({ partesReady: true });
  const s = run(
    [
      { type: "ARTIFACT_GENERATE_REQUESTED", id: volumeId },
      { type: "ARTIFACT_GENERATE_SUCCEEDED", id: volumeId, result: { pdf: "volume-b64" } },
    ],
    state,
  );
  const art = s.artifacts[volumeId] as Extract<NexoArtifact, { status: "ready" }>;
  assert.equal(art.status, "ready");
  assert.deepEqual(art.result, { pdf: "volume-b64" });
});

// (h) generate a partir de ready guarda prevResult; FAILED vira error
test("(h) re-gerar guarda prevResult; ARTIFACT_GENERATE_FAILED vira error", () => {
  const s1 = run(
    [{ type: "AGENT_TURN_SUCCEEDED", messageId: "a1", turn: turn([ldProposal]) }],
    comDossie(),
  );
  const id = mintArtifactId({
    kind: "ld",
    codigo: "ABC-100",
    revisao: "0",
    disciplinaKey: "estrutural",
  });
  const s2 = readyArtifact(s1, id, { pdf: "v1" });
  const s3 = nexoSessionReducer(s2, { type: "ARTIFACT_GENERATE_REQUESTED", id });
  const gen = s3.artifacts[id] as Extract<NexoArtifact, { status: "generating" }>;
  assert.equal(gen.status, "generating");
  assert.deepEqual(gen.prevResult, { pdf: "v1" }, "download antigo segue válido");

  const s4 = nexoSessionReducer(s3, {
    type: "ARTIFACT_GENERATE_FAILED",
    id,
    issue: {
      id: "iss1",
      scope: "ld",
      severity: "critico",
      code: "GEN_FALHOU",
      title: "Falhou",
      detail: "erro",
    },
  });
  const err = s4.artifacts[id] as Extract<NexoArtifact, { status: "error" }>;
  assert.equal(err.status, "error");
  assert.equal(err.error.code, "GEN_FALHOU");
});

// (i) focus/dismiss mexem no activeArtifactId
test("(i) ARTIFACT_FOCUSED/DISMISSED atualizam activeArtifactId", () => {
  const s1 = run(
    [{ type: "AGENT_TURN_SUCCEEDED", messageId: "a1", turn: turn([ldProposal]) }],
    comDossie(),
  );
  const id = mintArtifactId({
    kind: "ld",
    codigo: "ABC-100",
    revisao: "0",
    disciplinaKey: "estrutural",
  });
  const s2 = nexoSessionReducer(s1, { type: "ARTIFACT_FOCUSED", id });
  assert.equal(s2.activeArtifactId, id);
  const s3 = nexoSessionReducer(s2, { type: "ARTIFACT_DISMISSED", id });
  assert.equal(s3.artifacts[id], undefined, "artefato removido");
  assert.equal(s3.activeArtifactId, null, "active limpo ao descartar o ativo");
});

// (j) turno: STARTED -> thinking; SUCCEEDED -> idle
test("(j) AGENT_TURN_STARTED thinking, SUCCEEDED volta a idle", () => {
  const s1 = nexoSessionReducer(comDossie(), { type: "AGENT_TURN_STARTED" });
  assert.equal(s1.turn.status, "thinking");
  const s2 = nexoSessionReducer(s1, {
    type: "AGENT_TURN_SUCCEEDED",
    messageId: "a1",
    turn: turn([]),
  });
  assert.equal(s2.turn.status, "idle");
});

// --- Remoção de artefato gerado --------------------------------------------

/*
 * Excluir um artefato tira SÓ ele. A ordem dos demais é o que o canvas desenha
 * (capa → separatriz → LD → pranchas), então embaralhar aqui viraria um volume
 * fora de padrão.
 */
type ResultadoStub = { artifactId: string; files: { url: string }[] };
const listaDeResultados: ResultadoStub[] = [
  { artifactId: "capa:040", files: [{ url: "blob:a" }] },
  { artifactId: "ld:040:R0", files: [{ url: "blob:b" }] },
  { artifactId: "volume:040", files: [{ url: "blob:c" }] },
];

test("removerResultado: tira so o alvo e preserva a ordem dos outros", () => {
  const { restantes, removido } = removerResultado(listaDeResultados, "ld:040:R0");
  assert.deepEqual(
    restantes.map((r) => r.artifactId),
    ["capa:040", "volume:040"],
  );
  assert.equal(removido?.artifactId, "ld:040:R0");
});

test("removerResultado: id inexistente nao altera nada e nao lanca", () => {
  const { restantes, removido } = removerResultado(listaDeResultados, "nao-existe");
  assert.equal(restantes.length, 3);
  assert.equal(removido, null);
});

test("removerResultado: devolve o removido p/ o chamador revogar as URLs", () => {
  const { removido } = removerResultado(listaDeResultados, "capa:040");
  assert.deepEqual(
    removido?.files.map((f) => f.url),
    ["blob:a"],
  );
});

test("removerResultado: lista vazia devolve vazia", () => {
  const { restantes, removido } = removerResultado([] as ResultadoStub[], "x");
  assert.deepEqual(restantes, []);
  assert.equal(removido, null);
});

// --- Agrupamento por tomo (o canvas desenha uma fileira por tomo) -----------

test("tomoDoArtefato: le o sufixo do id", () => {
  assert.equal(tomoDoArtefato("capa:016:t02"), 2);
  assert.equal(tomoDoArtefato("ld:016:a:t01"), 1);
  assert.equal(tomoDoArtefato("volume:016"), 0, "sem sufixo = sem tomo");
  assert.equal(tomoDoArtefato("capa:016:t12"), 12);
});

test("agruparPorTomo: uma fileira por tomo, em ordem", () => {
  const g = agruparPorTomo([
    { id: "ld:016:a:t02" },
    { id: "capa:016:t01" },
    { id: "ld:016:a:t01" },
    { id: "capa:016:t02" },
  ]);
  assert.deepEqual(
    g.map((x) => x.tomo),
    [1, 2],
  );
  assert.equal(g[0].itens.length, 2);
});

test("agruparPorTomo: sobras da divisao anterior ficam por ULTIMO", () => {
  const g = agruparPorTomo([{ id: "volume:016" }, { id: "capa:016:t01" }]);
  assert.deepEqual(
    g.map((x) => x.tomo),
    [1, 0],
    "o resto sem tomo nao pode abrir o canvas",
  );
});

test("agruparPorTomo: sem tomo nenhum, uma fileira so", () => {
  const g = agruparPorTomo([{ id: "capa:016" }, { id: "ld:016:a" }]);
  assert.equal(g.length, 1);
  assert.equal(g[0].tomo, 0);
});

// --- Edição pelo canvas: a frase que vai para o histórico -------------------

/*
 * O que `descreverMudanca` devolve entra no histórico, e é dali que o agente
 * re-propõe os params no turno seguinte. Uma frase que não descreva a alteração
 * real faz o agente decidir sobre informação falsa — e o erro é INVISÍVEL,
 * porque o documento regerado está certo.
 */
const ROTULOS = { tituloCapa: "título da capa", volume: "volume", mes: "mês" };

test("descreverMudanca: um campo alterado gera a frase daquele campo", () => {
  const f = descreverMudanca(
    { tituloCapa: "A", volume: "1" },
    { tituloCapa: "B", volume: "1" },
    ROTULOS,
  );
  assert.equal(f, 'Alterei pelo canvas:\ntítulo da capa = "B"');
});

test("descreverMudanca: varios campos aparecem TODOS", () => {
  const f = descreverMudanca(
    { tituloCapa: "A", volume: "1" },
    { tituloCapa: "B", volume: "6" },
    ROTULOS,
  );
  assert.ok(f?.includes('título da capa = "B"'));
  assert.ok(f?.includes('volume = "6"'), "o volume nao pode sumir da frase");
});

test("descreverMudanca: nada alterado -> null (nao polui o historico)", () => {
  assert.equal(
    descreverMudanca({ tituloCapa: "A" }, { tituloCapa: "A" }, ROTULOS),
    null,
  );
  // Espaço em volta não é alteração.
  assert.equal(
    descreverMudanca({ tituloCapa: "A" }, { tituloCapa: "  A  " }, ROTULOS),
    null,
  );
});

test("descreverMudanca: titulo MULTILINHA sai inteiro, entre aspas", () => {
  const titulo = "PROJETO ESTRUTURAL CONCRETO\nIMPLANTAÇÃO";
  const f = descreverMudanca({ tituloCapa: "X" }, { tituloCapa: titulo }, ROTULOS);
  assert.ok(
    f?.includes(`título da capa = "${titulo}"`),
    "a quebra de linha nao pode cortar o titulo ao meio",
  );
});

test("descreverMudanca: campo fora dos rotulos e ignorado", () => {
  const f = descreverMudanca({ segredo: "1" }, { segredo: "2" }, ROTULOS);
  assert.equal(f, null, "so os campos com rotulo entram na frase");
});

test("orfaosAposDivisao: aumentar de 2 p/ 3 tomos nao orfana nada", () => {
  assert.equal(orfaosAposDivisao([1, 1, 2, 2], 3, 1), 0);
});

test("orfaosAposDivisao: reduzir de 3 p/ 2 tomos orfana o tomo 3", () => {
  assert.equal(orfaosAposDivisao([1, 2, 3, 3], 2, 1), 2, "os dois do tomo 3");
});

test("orfaosAposDivisao: dividir o que era unico orfana os sem-tomo", () => {
  assert.equal(orfaosAposDivisao([0, 0, 0], 3, 1), 3);
});

test("orfaosAposDivisao: voltar para um tomo so orfana os numerados", () => {
  assert.equal(orfaosAposDivisao([1, 2], 1, 1), 2);
});

console.log(`\n${passed} teste(s) passaram.`);
