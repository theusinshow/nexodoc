/**
 * A ATENÇÃO DO PAINEL — ordem, resumo e o que abre sozinho. Puro → node cru.
 *
 *   node scripts/test-atencao-do-painel.ts   (== npm run test:atencao-painel)
 */
import assert from "node:assert/strict";

import {
  abreSozinho,
  ordemDaAtencao,
  resumoDoProjeto,
  type ProjetoParaOrdenar,
} from "../lib/atencao-do-painel.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

const p = (over: Partial<ProjetoParaOrdenar> & { projectId: string }): ProjetoParaOrdenar => ({
  diasParado: 0,
  recebidos: 0,
  enviados: 0,
  atualizadoEmMs: 0,
  ...over,
});

console.log("atenção do painel\n");

test("mais parado primeiro — a ordem que a tela já promete", () => {
  /*
   * O canto direito da lista diz "mais parados primeiro" desde sempre, e era a
   * única promessa que a tela não cumpria.
   */
  const r = ordemDaAtencao([
    p({ projectId: "a", recebidos: 1, diasParado: 2 }),
    p({ projectId: "b", recebidos: 1, diasParado: 9 }),
    p({ projectId: "c", recebidos: 1, diasParado: 5 }),
  ]);
  assert.deepEqual(
    r.map((x) => x.projectId),
    ["b", "c", "a"],
  );
});

test("projeto SEM pendência vai depois de todos os que têm", () => {
  // Ele continua na lista — a home é "onde você está trabalhando" —, mas não
  // disputa o topo com trabalho que espera alguém.
  const r = ordemDaAtencao([
    p({ projectId: "quieto", atualizadoEmMs: 9999 }),
    p({ projectId: "comAchado", recebidos: 1, diasParado: 0 }),
  ]);
  assert.deepEqual(
    r.map((x) => x.projectId),
    ["comAchado", "quieto"],
  );
});

test("entre projetos sem pendência, o mais recente vem antes", () => {
  const r = ordemDaAtencao([
    p({ projectId: "velho", atualizadoEmMs: 100 }),
    p({ projectId: "novo", atualizadoEmMs: 900 }),
  ]);
  assert.deepEqual(
    r.map((x) => x.projectId),
    ["novo", "velho"],
  );
});

test("empate de dias parados é desfeito pelo mais recente", () => {
  const r = ordemDaAtencao([
    p({ projectId: "a", recebidos: 1, diasParado: 4, atualizadoEmMs: 100 }),
    p({ projectId: "b", recebidos: 1, diasParado: 4, atualizadoEmMs: 900 }),
  ]);
  assert.deepEqual(
    r.map((x) => x.projectId),
    ["b", "a"],
  );
});

test("a ordenação NÃO altera o array recebido", () => {
  // O chamador é React: mutar a prop faria o render seguinte ver outra lista.
  const entrada = [p({ projectId: "a" }), p({ projectId: "b", recebidos: 1 })];
  const copia = [...entrada];
  ordemDaAtencao(entrada);
  assert.deepEqual(entrada, copia);
});

test("o resumo de quem espera VOCÊ diz quantos", () => {
  const r = resumoDoProjeto({ recebidos: 3, enviados: 0, diasParado: 0, pessoas: [] });
  assert.equal(r.texto, "3 achados");
  assert.equal(r.realce, "seu");
});

test("um achado é 'achado', e não 'achados'", () => {
  const r = resumoDoProjeto({ recebidos: 1, enviados: 0, diasParado: 0, pessoas: [] });
  assert.equal(r.texto, "1 achado");
});

test("parado demais vira alerta, com o número de dias", () => {
  const r = resumoDoProjeto({ recebidos: 3, enviados: 0, diasParado: 7, pessoas: [] });
  assert.equal(r.texto, "3 achados · parado há 7 dias");
  assert.equal(r.realce, "alerta");
});

test("o que está com OUTROS diz COM QUEM — e não 'com outros'", () => {
  /*
   * "5 com outros" informa a quantidade e esconde o essencial. Quem olha a home
   * quer saber de quem cobrar.
   */
  const r = resumoDoProjeto({
    recebidos: 0,
    enviados: 5,
    diasParado: 0,
    pessoas: ["Milton"],
  });
  assert.equal(r.texto, "5 com Milton");
  assert.equal(r.realce, "quieto");
});

test("a mesma pessoa em cinco achados continua sendo UMA pessoa", () => {
  const r = resumoDoProjeto({
    recebidos: 0,
    enviados: 5,
    diasParado: 0,
    pessoas: ["Milton", "Milton", "Milton", "Milton", "Milton"],
  });
  assert.equal(r.texto, "5 com Milton");
});

test("com várias pessoas, conta — três nomes numa linha é repetição", () => {
  const r = resumoDoProjeto({
    recebidos: 0,
    enviados: 5,
    diasParado: 0,
    pessoas: ["Milton", "Carla", "Ana"],
  });
  assert.equal(r.texto, "5 com 3 pessoas");
});

test("sem achado nenhum, o resumo diz isso", () => {
  const r = resumoDoProjeto({ recebidos: 0, enviados: 0, diasParado: 0, pessoas: [] });
  assert.equal(r.texto, "sem pendência");
  assert.equal(r.realce, "quieto");
});

test("recebido VENCE enviado no resumo: o que é seu é o que importa", () => {
  const r = resumoDoProjeto({
    recebidos: 2,
    enviados: 9,
    diasParado: 0,
    pessoas: ["Milton"],
  });
  assert.equal(r.texto, "2 achados");
});

test("abre sozinho só o que é PARA VOCÊ", () => {
  /*
   * A linha `if (primeiro) setAbertos(...)` abria o primeiro cartão SEMPRE, e
   * na medição isso expandiu cinco achados que estavam com o Milton — o tipo
   * menos acionável que existe, ocupando a dobra inteira.
   */
  const so = abreSozinho([
    p({ projectId: "comOutros", enviados: 5 }),
    p({ projectId: "meu", recebidos: 2 }),
  ]);
  assert.equal(so, "meu");
});

test("nada para você, nada abre", () => {
  assert.equal(abreSozinho([p({ projectId: "a", enviados: 5 })]), null);
  assert.equal(abreSozinho([p({ projectId: "a" })]), null);
  assert.equal(abreSozinho([]), null);
});

test("abre UM só, e é o primeiro na ordem da atenção", () => {
  const so = abreSozinho(
    ordemDaAtencao([
      p({ projectId: "a", recebidos: 1, diasParado: 1 }),
      p({ projectId: "b", recebidos: 1, diasParado: 8 }),
    ]),
  );
  assert.equal(so, "b");
});

console.log(`\n${passed} passaram`);
