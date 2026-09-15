/**
 * Teste das regras da CONVERSA QUE ATRAVESSA A REDE.
 *
 * Três coisas erram em silêncio quando ninguém as testa, e as três estão aqui:
 *
 *   1. o servidor aceitar um registro torto e gravar lixo com aparência de ok;
 *   2. o registro grande demais estourar em algum lugar mais fundo em vez de
 *      voltar com um motivo — o testador acha que salvou;
 *   3. a fusão das listas SUMIR com conversa. Este é o caro: uma conversa que
 *      ainda não subiu não existe no servidor, e "não existe no servidor"
 *      nunca pode virar ordem de apagar o local.
 *
 * Nenhuma delas precisa de banco, de rede ou de tela para ser provada.
 *
 *   node scripts/test-nexo-conversa-remota.ts   (== npm run test:nexo:conversa-remota)
 */
import assert from "node:assert/strict";

import {
  LIMITE_BYTES,
  fundirListas,
  gravacaoDesatualizada,
  gravarComVersao,
  TENTATIVAS_DE_GRAVACAO,
  lapidesLocais,
  resumoDoRegistro,
  validarRegistro,
  type RegistroDaConversa,
  type ResumoDaConversa,
} from "../server/nexo/conversa-remota.ts";

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

function registro(over: Partial<RegistroDaConversa> = {}): RegistroDaConversa {
  return {
    id: "abc",
    title: "REFORMA DA ESCOLA",
    createdAt: 1_000,
    updatedAt: 2_000,
    messages: [],
    seloResults: [],
    results: [],
    ...over,
  };
}

function resumo(over: Partial<ResumoDaConversa> = {}): ResumoDaConversa {
  return { id: "x", title: "t", createdAt: 1, updatedAt: 1, ...over };
}

// ---------------------------------------------------------------------------
// Validar
// ---------------------------------------------------------------------------

test("o registro completo passa", () => {
  const v = validarRegistro(registro());
  assert.equal(v.ok, true);
});

test("o miolo desconhecido passa inteiro — o formato é schemaless", () => {
  const v = validarRegistro(registro({ campoQueAindaNaoExiste: { a: [1, 2] } }));
  assert.equal(v.ok, true);
  if (!v.ok) return;
  assert.deepEqual(v.registro.campoQueAindaNaoExiste, { a: [1, 2] });
});

test("sem id não passa", () => {
  const v = validarRegistro(registro({ id: "" }));
  assert.equal(v.ok, false);
  if (v.ok) return;
  assert.match(v.motivo, /id/);
});

test("sem título não passa — título vira coluna e a lista o lê", () => {
  const v = validarRegistro(registro({ title: "   " }));
  assert.equal(v.ok, false);
});

test("data inválida não passa", () => {
  assert.equal(validarRegistro(registro({ updatedAt: 0 })).ok, false);
  assert.equal(validarRegistro(registro({ createdAt: Number.NaN })).ok, false);
  assert.equal(
    validarRegistro(registro({ updatedAt: "ontem" as unknown as number })).ok,
    false,
  );
});

test("folderKey de tipo errado não passa", () => {
  const v = validarRegistro(registro({ folderKey: 84 as unknown as string }));
  assert.equal(v.ok, false);
});

test("array e null não são registro", () => {
  assert.equal(validarRegistro([]).ok, false);
  assert.equal(validarRegistro(null).ok, false);
  assert.equal(validarRegistro("{}").ok, false);
});

test("acima do teto volta com o motivo, e o motivo cita os megabytes", () => {
  const gordo = registro({ payload: "x".repeat(LIMITE_BYTES) });
  const v = validarRegistro(gordo);
  assert.equal(v.ok, false);
  if (v.ok) return;
  assert.match(v.motivo, /grande demais/);
  assert.match(v.motivo, /MB/);
});

test("o tamanho medido é o do JSON, não o do objeto", () => {
  const v = validarRegistro(registro());
  assert.equal(v.ok, true);
  if (!v.ok) return;
  assert.equal(v.bytes, new TextEncoder().encode(JSON.stringify(registro())).length);
});

test("ciclo não derruba o servidor — volta como não serializável", () => {
  const r = registro() as Record<string, unknown>;
  r.eu = r;
  const v = validarRegistro(r);
  assert.equal(v.ok, false);
  if (v.ok) return;
  assert.match(v.motivo, /serializ/);
});

// ---------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------

test("o resumo leva só o que vira coluna", () => {
  const r = resumoDoRegistro(registro({ folderKey: "084-25" }));
  assert.deepEqual(r, {
    id: "abc",
    title: "REFORMA DA ESCOLA",
    createdAt: 1_000,
    updatedAt: 2_000,
    folderKey: "084-25",
  });
});

test("auditoria pendente vira booleano no resumo", () => {
  const r = resumoDoRegistro(registro({ auditoriaPendente: { auditId: "a1" } }));
  assert.equal(r.temAuditoriaPendente, true);
});

test("sem auditoria pendente o campo nem aparece", () => {
  assert.equal("temAuditoriaPendente" in resumoDoRegistro(registro()), false);
});

// ---------------------------------------------------------------------------
// Fundir — o caro
// ---------------------------------------------------------------------------

test("o que só existe no disco FICA (sincronizar pode ter falhado)", () => {
  const out = fundirListas([resumo({ id: "local" })], []);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "local");
  assert.equal(out[0].soNoServidor, false);
});

test("o que só existe no servidor entra MARCADO", () => {
  const out = fundirListas([], [resumo({ id: "remota" })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].soNoServidor, true);
});

test("a remota mais nova vence, e deixa de ser 'só no servidor'", () => {
  const out = fundirListas(
    [resumo({ id: "a", title: "velho", updatedAt: 10 })],
    [resumo({ id: "a", title: "novo", updatedAt: 20 })],
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "novo");
  assert.equal(out[0].soNoServidor, false);
});

test("o tipo do disco sobrevive quando a remota vence sem tipo", () => {
  // A listagem do servidor le so as colunas de fora, e `tipo` nao e uma delas.
  // Sem a guarda, toda auditoria editada noutra maquina voltaria para a secao
  // de montagem na proxima sincronizacao.
  const out = fundirListas(
    [resumo({ id: "a", updatedAt: 10, tipo: "auditoria" })],
    [resumo({ id: "a", updatedAt: 20 })],
  );
  assert.equal(out[0].tipo, "auditoria");
  assert.equal(out[0].soNoServidor, false);
});

test("o tipo que a remota traz vence o do disco", () => {
  const out = fundirListas(
    [resumo({ id: "a", updatedAt: 10, tipo: "volume" })],
    [resumo({ id: "a", updatedAt: 20, tipo: "auditoria" })],
  );
  assert.equal(out[0].tipo, "auditoria");
});

test("a local mais nova vence", () => {
  const out = fundirListas(
    [resumo({ id: "a", title: "novo", updatedAt: 30 })],
    [resumo({ id: "a", title: "velho", updatedAt: 20 })],
  );
  assert.equal(out[0].title, "novo");
});

test("empate resolve para o local — é o que a pessoa está vendo", () => {
  const out = fundirListas(
    [resumo({ id: "a", title: "local", updatedAt: 20 })],
    [resumo({ id: "a", title: "servidor", updatedAt: 20 })],
  );
  assert.equal(out[0].title, "local");
});

test("a saída sai ordenada da mais nova para a mais velha", () => {
  const out = fundirListas(
    [resumo({ id: "a", updatedAt: 10 }), resumo({ id: "b", updatedAt: 50 })],
    [resumo({ id: "c", updatedAt: 30 })],
  );
  assert.deepEqual(
    out.map((c) => c.id),
    ["b", "c", "a"],
  );
});

test("nenhuma conversa se perde na fusão", () => {
  const locais = [resumo({ id: "a" }), resumo({ id: "b" })];
  const remotas = [resumo({ id: "b" }), resumo({ id: "c" })];
  const out = fundirListas(locais, remotas);
  assert.deepEqual(
    out.map((c) => c.id).sort(),
    ["a", "b", "c"],
  );
});

test("as duas listas vazias devolvem lista vazia, não estouram", () => {
  assert.deepEqual(fundirListas([], []), []);
});

test("fundir não altera as listas recebidas", () => {
  const locais = [resumo({ id: "a", updatedAt: 10 })];
  const remotas = [resumo({ id: "a", updatedAt: 20 })];
  fundirListas(locais, remotas);
  assert.equal("soNoServidor" in locais[0], false);
  assert.equal("soNoServidor" in remotas[0], false);
});

test("o projectId sobrevive à validação e ao resumo", () => {
  const v = validarRegistro(registro({ projectId: "proj-063-26" }));
  assert.equal(v.ok, true);
  if (!v.ok) return;
  assert.equal(resumoDoRegistro(v.registro).projectId, "proj-063-26");
});

test("projectId de tipo errado é recusado, não convertido", () => {
  // Vira coluna e chave estrangeira: um número aqui quebraria a gravação lá.
  const v = validarRegistro({ ...registro(), projectId: 7 });
  assert.equal(v.ok, false);
});

test("conversa a endereçar não inventa projectId", () => {
  const v = validarRegistro(registro());
  assert.equal(v.ok, true);
  if (!v.ok) return;
  assert.equal(resumoDoRegistro(v.registro).projectId, undefined);
});

/* ─────────────────────────────── a lápide ─────────────────────────────── */

test("ausência continua NÃO apagando — a regra que a lápide não afrouxa", () => {
  /*
   * A conversa está no disco e não está no servidor. Sem lápide, ela FICA.
   * Ausência é indistinguível de "ainda não subiu", e sumir com o trabalho de
   * alguém por causa de uma rede ruim é inaceitável.
   */
  const out = fundirListas([resumo({ id: "so-local" })], [], []);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "so-local");
});

test("lápide tira a conversa da lista mesmo estando no disco", () => {
  const out = fundirListas([resumo({ id: "morta" }), resumo({ id: "viva" })], [], ["morta"]);
  assert.deepEqual(
    out.map((c) => c.id),
    ["viva"],
  );
});

test("lápide também vence o que o servidor ainda lista", () => {
  /*
   * Acontece de propósito: o expurgo grava a lápide ANTES de apagar a conversa.
   * Entre as duas gravações a listagem ainda a traz, e sem esta regra ela
   * reapareceria na tela por um instante.
   */
  assert.deepEqual(fundirListas([], [resumo({ id: "morta" })], ["morta"]), []);
});

test("sem lápide nenhuma, a fusão é exatamente a de antes", () => {
  // O terceiro argumento é opcional: os 27 casos acima continuam valendo.
  const out = fundirListas([resumo({ id: "a" })], [resumo({ id: "b" })]);
  assert.equal(out.length, 2);
});

test("lápide de conversa que este disco nunca viu não gera trabalho", () => {
  // A lápide vale para todas as máquinas do dono, e a maioria não tinha aquela
  // conversa. Não é erro.
  assert.deepEqual(lapidesLocais([resumo({ id: "a" })], ["outra"]), []);
});

test("lápide aponta o que apagar deste disco", () => {
  assert.deepEqual(lapidesLocais([resumo({ id: "a" }), resumo({ id: "b" })], ["b", "c"]), ["b"]);
});

// ---------------------------------------------------------------------------
// A aba desatualizada (C3, decidido em 15/09/2026)

test("a aba que leu a versão guardada grava", () => {
  assert.equal(gravacaoDesatualizada({ guardada: 2_000, base: 2_000 }), false);
});

test("a versão guardada mudou depois da base: a gravação é recusada", () => {
  assert.equal(gravacaoDesatualizada({ guardada: 3_000, base: 2_000 }), true);
});

test("base MAIS NOVA que a guardada é gravação desta aba ainda a caminho, não conflito", () => {
  assert.equal(gravacaoDesatualizada({ guardada: 2_000, base: 3_000 }), false);
});

test("sem base (conversa nova, ou cliente de antes da regra) nunca recusa", () => {
  assert.equal(gravacaoDesatualizada({ guardada: 3_000, base: null }), false);
});

test("sem nada guardado não há o que proteger", () => {
  assert.equal(gravacaoDesatualizada({ guardada: null, base: 2_000 }), false);
});

test("guardada mais nova que a base, mas mandada por ESTA aba (ainda sem confirmação): grava", () => {
  // A gravação em dupla (agora + commit) sai antes de a primeira voltar: a
  // segunda leva a mesma base e a primeira entre as próprias.
  assert.equal(gravacaoDesatualizada({ guardada: 3_000, base: 2_000, proprias: [3_000] }), false);
});

test("as próprias não salvam a versão de OUTRA aba", () => {
  assert.equal(gravacaoDesatualizada({ guardada: 2_500, base: 2_000, proprias: [3_000] }), true);
});

console.log(`\n${passed} verificações passaram.`);

/*
 * COMPARE-AND-SET NA GRAVAÇÃO — revisão final da segunda rodada, 15/09/2026.
 *
 * A rota lia a versão guardada e depois fazia `upsert`: duas gravações podiam
 * ler a mesma versão, passar pelas duas regras e a segunda sobrescrever a
 * primeira. Agora a escrita só pousa se a versão lida ainda for a guardada
 * (`updateMany ... where updatedAt = lida`), e a criação que bate na chave
 * (P2002) relê. Cada desencontro relê e reaplica as regras; desencontros sem
 * fim (mais de `TENTATIVAS_DE_GRAVACAO`) são 409.
 *
 * Por que não UMA releitura só: medido na c3 (15/09/2026), a própria aba manda
 * três gravações quase juntas (agora + commit + debounce). A terceira errava a
 * versão duas vezes — as outras duas pousavam entre a leitura e a escrita dela —
 * e o 409 falso travava a aba que auditava: o parecer nunca subia.
 */
type Dono = { userEmail: string; updatedAt: number } | null;

function banco(leituras: Dono[], opcoes: { criacoes?: ("ok" | "ja-existe")[]; atualizacoes?: number[] } = {}) {
  const chamadas: string[] = [];
  const criacoes = [...(opcoes.criacoes ?? [])];
  const atualizacoes = [...(opcoes.atualizacoes ?? [])];
  return {
    chamadas,
    ler: async () => {
      chamadas.push("ler");
      return leituras.shift() ?? null;
    },
    criar: async () => {
      chamadas.push("criar");
      return criacoes.shift() ?? "ok";
    },
    atualizarSe: async (versaoLida: number) => {
      chamadas.push(`atualizarSe:${versaoLida}`);
      return atualizacoes.shift() ?? 1;
    },
  };
}

const EU = "eu@prosul.com.br";
let passedAsync = 0;
async function testAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passedAsync++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

await testAsync("sem nada guardado: cria", async () => {
  const b = banco([null]);
  assert.equal(await gravarComVersao({ ...b, userEmail: EU, updatedAt: 5_000, base: null, proprias: [] }), "gravada");
  assert.deepEqual(b.chamadas, ["ler", "criar"]);
});

await testAsync("guardada da mesma pessoa: atualiza SÓ se a versão lida ainda for a guardada", async () => {
  const b = banco([{ userEmail: EU, updatedAt: 4_000 }]);
  assert.equal(await gravarComVersao({ ...b, userEmail: EU, updatedAt: 5_000, base: 4_000, proprias: [] }), "gravada");
  assert.deepEqual(b.chamadas, ["ler", "atualizarSe:4000"]);
});

await testAsync("conversa de outra pessoa: recusa sem escrever", async () => {
  const b = banco([{ userEmail: "outro@prosul.com.br", updatedAt: 1_000 }]);
  assert.equal(await gravarComVersao({ ...b, userEmail: EU, updatedAt: 5_000, base: null, proprias: [] }), "outro-dono");
  assert.deepEqual(b.chamadas, ["ler"]);
});

await testAsync("guardada mais nova que a gravação: ignorada sem escrever", async () => {
  const b = banco([{ userEmail: EU, updatedAt: 6_000 }]);
  assert.equal(await gravarComVersao({ ...b, userEmail: EU, updatedAt: 5_000, base: null, proprias: [] }), "ignorada");
  assert.deepEqual(b.chamadas, ["ler"]);
});

await testAsync("base velha: desatualizada sem escrever", async () => {
  const b = banco([{ userEmail: EU, updatedAt: 4_500 }]);
  assert.equal(await gravarComVersao({ ...b, userEmail: EU, updatedAt: 5_000, base: 4_000, proprias: [] }), "desatualizada");
  assert.deepEqual(b.chamadas, ["ler"]);
});

await testAsync("a CORRIDA: outra aba gravou entre a leitura e a escrita — relê e recusa pela base", async () => {
  const b = banco(
    [
      { userEmail: EU, updatedAt: 4_000 },
      { userEmail: EU, updatedAt: 4_800 },
    ],
    { atualizacoes: [0] },
  );
  assert.equal(await gravarComVersao({ ...b, userEmail: EU, updatedAt: 5_000, base: 4_000, proprias: [] }), "desatualizada");
  assert.deepEqual(b.chamadas, ["ler", "atualizarSe:4000", "ler"]);
});

await testAsync("a corrida com uma gravação MAIS NOVA: relê e ignora", async () => {
  const b = banco(
    [
      { userEmail: EU, updatedAt: 4_000 },
      { userEmail: EU, updatedAt: 6_000 },
    ],
    { atualizacoes: [0] },
  );
  assert.equal(await gravarComVersao({ ...b, userEmail: EU, updatedAt: 5_000, base: null, proprias: [] }), "ignorada");
});

await testAsync("a corrida com a PRÓPRIA gravação em dupla: relê e grava contra a versão nova", async () => {
  const b = banco(
    [
      { userEmail: EU, updatedAt: 4_000 },
      { userEmail: EU, updatedAt: 4_900 },
    ],
    { atualizacoes: [0, 1] },
  );
  assert.equal(
    await gravarComVersao({ ...b, userEmail: EU, updatedAt: 5_000, base: 4_000, proprias: [4_900] }),
    "gravada",
  );
  assert.deepEqual(b.chamadas, ["ler", "atualizarSe:4000", "ler", "atualizarSe:4900"]);
});

await testAsync("a rajada da própria aba (medida na c3): dois desencontros seguidos e ainda grava", async () => {
  const b = banco(
    [
      { userEmail: EU, updatedAt: 4_000 },
      { userEmail: EU, updatedAt: 4_900 },
      { userEmail: EU, updatedAt: 4_950 },
    ],
    { atualizacoes: [0, 0, 1] },
  );
  assert.equal(
    await gravarComVersao({ ...b, userEmail: EU, updatedAt: 5_000, base: 4_000, proprias: [4_900, 4_950] }),
    "gravada",
  );
  assert.deepEqual(b.chamadas, ["ler", "atualizarSe:4000", "ler", "atualizarSe:4900", "ler", "atualizarSe:4950"]);
});

/*
 * Desencontros sem fim são CONCORRÊNCIA, não conflito (15/09/2026): virar
 * "desatualizada" travava a aba como se outra aba tivesse gravado por cima, e
 * a pessoa só saía recarregando. É passageiro — a rota responde 503 e a
 * próxima gravação tenta de novo.
 */
await testAsync("desencontros sem fim: concorrência (503), com as tentativas contadas", async () => {
  const leituras = Array.from({ length: TENTATIVAS_DE_GRAVACAO + 2 }, (_, i) => ({ userEmail: EU, updatedAt: 4_000 + i }));
  const b = banco(leituras, { atualizacoes: leituras.map(() => 0) });
  assert.equal(await gravarComVersao({ ...b, userEmail: EU, updatedAt: 5_000, base: null, proprias: [] }), "concorrencia");
  assert.equal(b.chamadas.filter((c) => c.startsWith("atualizarSe")).length, TENTATIVAS_DE_GRAVACAO);
});

await testAsync("criação que bate na chave (P2002): relê e reaplica as regras", async () => {
  const b = banco([null, { userEmail: EU, updatedAt: 4_800 }], { criacoes: ["ja-existe"] });
  assert.equal(await gravarComVersao({ ...b, userEmail: EU, updatedAt: 5_000, base: 4_000, proprias: [] }), "desatualizada");
  assert.deepEqual(b.chamadas, ["ler", "criar", "ler"]);
});

await testAsync("criação que bate na chave de OUTRA pessoa: outro-dono", async () => {
  const b = banco([null, { userEmail: "outro@prosul.com.br", updatedAt: 4_800 }], { criacoes: ["ja-existe"] });
  assert.equal(await gravarComVersao({ ...b, userEmail: EU, updatedAt: 5_000, base: null, proprias: [] }), "outro-dono");
});

await testAsync("cliente antigo, sem cabeçalho de base: continua gravando", async () => {
  const b = banco([{ userEmail: EU, updatedAt: 4_000 }]);
  assert.equal(await gravarComVersao({ ...b, userEmail: EU, updatedAt: 5_000, base: null, proprias: [] }), "gravada");
});

console.log(`${passedAsync} verificações de compare-and-set passaram.`);
