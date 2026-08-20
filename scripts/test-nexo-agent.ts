/**
 * Smoke-test da NORMALIZAÇÃO do agente Nexo (parte determinística/pura do
 * roteador de intenção). Trava o mapeamento de prefeitura (tolerante a acento) e
 * os defaults das propostas — o que dá pra garantir sem chamar a IA.
 *
 *   node scripts/test-nexo-agent.ts   (== npm run test:nexo:agent)
 */
import assert from "node:assert/strict";

import {
  casarPrefeituraDoCarimbo,
  clampTomos,
  matchPrefeitura,
  normalizeProposals,
  type AgentPrefeitura,
} from "../server/nexo/agent/normalize.ts";

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

const PREFS: AgentPrefeitura[] = [
  { id: "prefchap", nome: "Chapecó — Padrão" },
  { id: "prefflor", nome: "Florianópolis" },
  { id: "prefcri", nome: "Criciúma" },
];

test("clampTomos: default 1, limita e piso", () => {
  assert.equal(clampTomos(undefined), 1);
  assert.equal(clampTomos(0), 1);
  assert.equal(clampTomos(-5), 1);
  assert.equal(clampTomos(3), 3);
  assert.equal(clampTomos("4"), 4);
  assert.equal(clampTomos(999), 99);
});

test("matchPrefeitura: id exato", () => {
  assert.equal(matchPrefeitura({ id: "prefcri" }, PREFS)?.id, "prefcri");
});

test("matchPrefeitura: sem acento (chapeco -> Chapecó)", () => {
  assert.equal(matchPrefeitura({ nome: "chapeco" }, PREFS)?.id, "prefchap");
});

test("matchPrefeitura: verboso (prefeitura de chapecó -> Chapecó)", () => {
  assert.equal(
    matchPrefeitura({ nome: "prefeitura de chapecó" }, PREFS)?.id,
    "prefchap",
  );
});

test("matchPrefeitura: sem correspondência -> null", () => {
  assert.equal(matchPrefeitura({ nome: "joinville" }, PREFS), null);
});

/*
 * OS NOMES REAIS, como estão nos config.json. O fixture curto acima ("Criciúma",
 * "Florianópolis") escondia dois defeitos que só aparecem com o nome completo,
 * porque todos eles compartilham as palavras "prefeitura" e "municipal".
 */
const REAIS: AgentPrefeitura[] = [
  { id: "prefchap", nome: "Prefeitura Municipal de Chapecó" },
  { id: "pmcriciuma", nome: "Prefeitura Municipal de Criciúma" },
  { id: "prefflor", nome: "Prefeitura Municipal de Florianópolis" },
  { id: "prefsjose", nome: "Prefeitura Municipal de São José" },
];

/** O rodapé que sai impresso em TODA prancha deste escritório. */
const ENDERECO_DA_PROSUL =
  "Rua Saldanha Marinho, 116 - Edifício Liberal Center - 3º andar - Centro - " +
  "Florianópolis - SC Fone/Fax: (48) 3027-2730";

test("matchPrefeitura: o ENDEREÇO do escritório não é prefeitura nenhuma", () => {
  /*
   * O defeito que mandou um volume de CRICIÚMA sair como Florianópolis: a regra
   * de token casava "florianopolis" em qualquer lugar do texto, e a PROSUL fica
   * em Florianópolis — o endereço dela está em todas as 71 pranchas.
   */
  assert.equal(matchPrefeitura({ nome: ENDERECO_DA_PROSUL }, REAIS), null);
});

test("matchPrefeitura: nome real casa a prefeitura certa", () => {
  assert.equal(
    matchPrefeitura({ nome: "PREFEITURA MUNICIPAL DE CRICIÚMA" }, REAIS)?.id,
    "pmcriciuma",
  );
});

test("casarPrefeituraDoCarimbo: nome real resolve UMA, não fica ambíguo", () => {
  /*
   * Com os nomes completos, "prefeitura" e "municipal" são tokens de TODAS —
   * então todas eram plausíveis, `plausibleCount` nunca era 1, e o casamento
   * pelo carimbo nunca resolvia nada. O default silencioso decidia no lugar dele.
   */
  const r = casarPrefeituraDoCarimbo(
    [{ cliente: "PREFEITURA MUNICIPAL DE CRICIÚMA" }, { cliente: "PREFEITURA MUNICIPAL DE CRICIÚMA" }],
    REAIS,
  );
  assert.equal(r?.plausibleCount, 1);
  assert.equal(r?.resolvedId, "pmcriciuma");
});

/*
 * O BRASÃO É A SEGUNDA EVIDÊNCIA.
 *
 * O carimbo traz o nome escrito E o brasão. Usar só o texto deixa o casamento
 * refém de uma leitura: carimbo apagado, grafia estranha ou campo `cliente`
 * ausente e a prefeitura vira pergunta com o brasão bem ali na folha.
 */
test("logo resolve quando o texto do cliente não veio", () => {
  const r = casarPrefeituraDoCarimbo(
    [
      { cliente: null, logoOrgao: "PREFEITURA MUNICIPAL DE CHAPECÓ" },
      { cliente: "", logoOrgao: "PREFEITURA MUNICIPAL DE CHAPECÓ" },
    ],
    REAIS,
  );
  assert.equal(r?.resolvedId, "prefchap");
  assert.equal(r?.motivo, "so-logo");
});

test("texto e logo concordando resolvem com o motivo registrado", () => {
  const r = casarPrefeituraDoCarimbo(
    [
      { cliente: "PREFEITURA MUNICIPAL DE CRICIÚMA", logoOrgao: "PREFEITURA DE CRICIÚMA" },
      { cliente: "PREFEITURA MUNICIPAL DE CRICIÚMA", logoOrgao: "PREFEITURA DE CRICIÚMA" },
    ],
    REAIS,
  );
  assert.equal(r?.resolvedId, "pmcriciuma");
  assert.equal(r?.motivo, "texto-e-logo");
});

/*
 * O CASO QUE ESTE MÓDULO EXISTE PARA PEGAR: o volume com o brasão de outra
 * prefeitura. Resolver sozinho aqui aprovaria no escuro exatamente o acidente
 * mais caro — a decisão de PARA QUEM o volume vai é humana.
 */
test("texto e logo DIVERGINDO não resolvem — viram pergunta", () => {
  const r = casarPrefeituraDoCarimbo(
    [
      { cliente: "PREFEITURA MUNICIPAL DE CRICIÚMA", logoOrgao: "PREFEITURA MUNICIPAL DE CHAPECÓ" },
      { cliente: "PREFEITURA MUNICIPAL DE CRICIÚMA", logoOrgao: "PREFEITURA MUNICIPAL DE CHAPECÓ" },
    ],
    REAIS,
  );
  assert.equal(r?.resolvedId, null, "não escolhe entre o texto e o brasão");
  assert.equal(r?.motivo, "divergem");
  assert.equal(r?.plausibleCount, 2, "oferece os dois como opção");
});

test("o endereço da PROSUL não vira prefeitura nem vindo do logo", () => {
  const r = casarPrefeituraDoCarimbo(
    [{ cliente: null, logoOrgao: ENDERECO_DA_PROSUL }],
    REAIS,
  );
  assert.equal(r?.resolvedId ?? null, null);
});

/*
 * INSTRUMENTAÇÃO: quando o slot volta a perguntar, o motivo diz qual dos casos
 * ocorreu. Sem isso, "perguntou de novo" é indistinguível de "não leu nada".
 */
test("sem evidência nenhuma, o motivo diz que não houve leitura", () => {
  const r = casarPrefeituraDoCarimbo([{ cliente: null, logoOrgao: null }], REAIS);
  assert.equal(r?.motivo, "sem-evidencia");
  assert.equal(r?.resolvedId ?? null, null);
});

test("variante ambígua continua sendo pergunta, com o motivo próprio", () => {
  const DUAS: AgentPrefeitura[] = [
    { id: "prefflor-a", nome: "Prefeitura Municipal de Florianópolis" },
    { id: "prefflor-b", nome: "Prefeitura Municipal de Florianópolis — Obras" },
  ];
  const r = casarPrefeituraDoCarimbo(
    [{ cliente: "PREFEITURA MUNICIPAL DE FLORIANÓPOLIS", logoOrgao: null }],
    DUAS,
  );
  assert.equal(r?.resolvedId, null);
  assert.equal(r?.motivo, "ambiguo");
  assert.equal(r?.plausibleCount, 2);
});

test("selo sem o campo de logo continua funcionando como antes", () => {
  const r = casarPrefeituraDoCarimbo(
    [{ cliente: "PREFEITURA MUNICIPAL DE CRICIÚMA" }],
    REAIS,
  );
  assert.equal(r?.resolvedId, "pmcriciuma");
  assert.equal(r?.motivo, "so-texto");
});

test("normalizeProposals: sem prefeitura reconhecida NÃO inventa a primeira", () => {
  /*
   * `templateId` preenchido faz o slot chegar "já respondido", e a pergunta
   * nunca acontece. Um palpite aqui é o volume indo para a prefeitura errada
   * sem ninguém ver — o erro que este produto existe para impedir.
   */
  const r = normalizeProposals(
    [{ kind: "capa", prefeitura: ENDERECO_DA_PROSUL, tituloCapa: "PROJETO ESTRUTURAL" }],
    { disciplina: "Estrutural", prefeituras: REAIS },
  );
  assert.equal(r.length, 1, "a proposta não pode sumir — ela vira pergunta");
  assert.equal(
    (r[0].params as { templateId: string }).templateId,
    "",
    "prefeitura incerta tem de ficar VAZIA, para virar pergunta",
  );
});

test("normalizeProposals: ld com defaults (titulo vazio, tomos 1)", () => {
  const r = normalizeProposals([{ kind: "ld" }], {
    disciplina: "EST",
    prefeituras: PREFS,
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, "ld");
  assert.equal((r[0].params as { tituloLd: string }).tituloLd, "");
  assert.equal((r[0].params as { numTomos: number }).numTomos, 1);
});

/*
 * A DATA DA CAPA SAI DO CARIMBO, NAO DO RELOGIO.
 *
 * Medido em 20/08/2026 no volume 10 de 040-26: as 20 pranchas dizem
 * JUNHO/2026 no carimbo e a capa saia AGOSTO/2026, o mes em que foi montada.
 * Num volume reemitido meses depois, a capa passa a discordar de todas as
 * pranchas que ela encaderna.
 *
 * A regra ja existia nos slots (`mesSlot` deriva de `facts.dataDoSelo`) e no
 * comentario que a acompanha -- "a fonte e o DOCUMENTO, nao o relogio". O que
 * faltava era a resolucao CHEGAR na proposta: `mes`/`ano` vinham so do que o
 * modelo emitia, e o modelo os deixava vazios.
 */
test("normalizeProposals: capa sem data usa a do carimbo", () => {
  const r = normalizeProposals([{ kind: "capa", prefeitura: "Chapecó" }], {
    disciplina: "EST",
    prefeituras: PREFS,
    dataDoSelo: { mes: 6, ano: 2026 },
  });
  const p = r[0].params as { mes: string; ano: string };
  assert.equal(p.mes, "6");
  assert.equal(p.ano, "2026");
});

test("normalizeProposals: data pedida na conversa vence o carimbo", () => {
  const r = normalizeProposals(
    [{ kind: "capa", prefeitura: "Chapecó", mes: "9", ano: "2027" }],
    { disciplina: "EST", prefeituras: PREFS, dataDoSelo: { mes: 6, ano: 2026 } },
  );
  const p = r[0].params as { mes: string; ano: string };
  assert.equal(p.mes, "9");
  assert.equal(p.ano, "2027");
});

/*
 * SEM DATA NO CARIMBO nada muda: vazio continua significando "use o padrao do
 * builder", que e o mes corrente. E o comportamento de quem nao pediu data.
 */
test("normalizeProposals: sem data no carimbo, o campo segue vazio", () => {
  const r = normalizeProposals([{ kind: "capa", prefeitura: "Chapecó" }], {
    disciplina: "EST",
    prefeituras: PREFS,
  });
  const p = r[0].params as { mes: string; ano: string };
  assert.equal(p.mes, "");
  assert.equal(p.ano, "");
});
test("normalizeProposals: capa mapeia prefeitura pelo nome", () => {
  const r = normalizeProposals(
    [{ kind: "capa", prefeitura: "Chapecó", volume: "2", numTomos: 4 }],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal(r.length, 1);
  const params = r[0].params as { templateId: string; volume: string; numTomos: number };
  assert.equal(params.templateId, "prefchap");
  assert.equal(params.volume, "2");
  assert.equal(params.numTomos, 4);
});

test("normalizeProposals: capa sem match fica SEM prefeitura, para perguntar", () => {
  /*
   * Este teste afirmava o contrário — "cai no 1o template" — e o defeito que
   * ele protegia mandou um volume de Criciúma sair inteiro como Florianópolis,
   * sem uma pergunta sequer. Palpite de prefeitura não é conveniência: é o
   * documento indo para o município errado.
   */
  const r = normalizeProposals([{ kind: "capa", prefeitura: "xyz" }], {
    disciplina: "EST",
    prefeituras: PREFS,
  });
  assert.equal((r[0].params as { templateId: string }).templateId, "");
});

test("normalizeProposals: volume não-numérico vira vazio", () => {
  const r = normalizeProposals([{ kind: "capa", prefeitura: "Criciúma", volume: "dois" }], {
    disciplina: "EST",
    prefeituras: PREFS,
  });
  assert.equal((r[0].params as { volume: string }).volume, "");
});

test("normalizeProposals: kind inválido e não-array são ignorados", () => {
  assert.deepEqual(normalizeProposals("nao-array", { disciplina: "X", prefeituras: PREFS }), []);
  assert.deepEqual(
    normalizeProposals([{ kind: "foo" }, null, 3], { disciplina: "X", prefeituras: PREFS }),
    [],
  );
});

test("normalizeProposals: ld + capa juntas", () => {
  const r = normalizeProposals(
    [{ kind: "ld" }, { kind: "capa", prefeitura: "Florianópolis" }],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal(r.length, 2);
  assert.equal(r[0].kind, "ld");
  assert.equal(r[1].kind, "capa");
  assert.equal((r[1].params as { templateId: string }).templateId, "prefflor");
});

// --- PR4: novos kinds (separatriz | auditoria | conferencia | volume) -------

test("normalizeProposals: separatriz casa prefeitura e clampa tomos", () => {
  const r = normalizeProposals(
    [{ kind: "separatriz", prefeitura: "chapeco", numTomos: 999 }],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, "separatriz");
  const params = r[0].params as { templateId: string; numTomos: number };
  assert.equal(params.templateId, "prefchap");
  assert.equal(params.numTomos, 99); // clampTomos limita a 99
  /*
   * Separatriz não tem volume. Tem `titulos` desde a paridade com a tela antiga
   * (`93f1a03`): a lista de disciplinas ditada pelo engenheiro, uma folha por
   * item. Vazia aqui, porque este caso não lista nenhuma — e vazia significa
   * "herda o título da capa", que é o comportamento de sempre.
   */
  assert.deepEqual(Object.keys(params).sort(), ["numTomos", "templateId", "titulos"]);
  assert.deepEqual((params as { titulos: string[] }).titulos, []);
});

test("normalizeProposals: separatriz sem match NÃO cai no 1o template", () => {
  /*
   * ESTE TESTE AFIRMAVA O DEFEITO, e é por isso que ele sobreviveu.
   *
   * Ele dizia "separatriz sem match cai no 1o template" e passava verde
   * enquanto um volume de Criciúma saía com separatriz de Chapecó — porque em
   * produção o 1º template É Chapecó. A capa foi endurecida contra o mesmo
   * `|| firstTemplateId` (o comentário em `normalize.ts` conta o incidente
   * Florianópolis) e ninguém veio conferir se a separatriz tinha ficado para
   * trás. Tinha, e este teste guardava a porta.
   *
   * Um teste que descreve o que o código faz, em vez do que ele deve fazer,
   * não protege nada: ele impede o conserto.
   */
  const r = normalizeProposals([{ kind: "separatriz", prefeitura: "xyz" }], {
    disciplina: "EST",
    prefeituras: PREFS,
  });
  assert.equal(
    (r[0].params as { templateId: string }).templateId,
    "",
    "prefeitura que não casa vira PERGUNTA, nunca a primeira da lista",
  );
});

test("normalizeProposals: auditoria nivel 'deep' é preservado", () => {
  const r = normalizeProposals([{ kind: "auditoria", nivel: "deep" }], {
    disciplina: "EST",
    prefeituras: PREFS,
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, "auditoria");
  assert.equal((r[0].params as { nivel: string }).nivel, "deep");
});

test("normalizeProposals: auditoria nivel inválido/ausente -> 'deep'", () => {
  /*
   * O PADRÃO INVERTEU EM 17/08/2026, e este teste afirmava o defeito.
   *
   * Com o slot de nível removido, a proposta passou a chegar SEM o campo — e
   * cair em "standard" fez toda auditoria amostrar 16% do documento em vez de
   * lê-lo inteiro. O parecer do 084_25 encontrou 6 de 25 achados de referência
   * por causa disso. Ver [[analysis-level.ts]] para os números medidos.
   */
  const r = normalizeProposals(
    [{ kind: "auditoria", nivel: "xyz" }, { kind: "auditoria" }],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal(r.length, 2);
  assert.equal((r[0].params as { nivel: string }).nivel, "deep");
  assert.equal((r[1].params as { nivel: string }).nivel, "deep");
});

test("normalizeProposals: 'standard' EXPLÍCITO continua respeitado", () => {
  // Conversa gravada antes da remoção do slot ainda traz o campo, e serve para
  // benchmark. O padrão mudou; a escolha explícita não deixou de valer.
  const r = normalizeProposals([{ kind: "auditoria", nivel: "standard" }], {
    disciplina: "EST",
    prefeituras: PREFS,
  });
  assert.equal((r[0].params as { nivel: string }).nivel, "standard");
});

test("normalizeProposals: conferencia e volume normalizam com params vazio", () => {
  const r = normalizeProposals(
    [{ kind: "conferencia" }, { kind: "volume" }],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal(r.length, 2);
  assert.equal(r[0].kind, "conferencia");
  assert.equal(r[1].kind, "volume");
  assert.deepEqual(r[0].params, {});
  assert.deepEqual(r[1].params, {});
});

test("normalizeProposals: kind desconhecido continua ignorado (degrada gracioso)", () => {
  const r = normalizeProposals(
    [{ kind: "separatriz", prefeitura: "Chapecó" }, { kind: "quimera" }, { kind: "volume" }],
    { disciplina: "EST", prefeituras: PREFS },
  );
  // só separatriz + volume; "quimera" some.
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((p) => p.kind), ["separatriz", "volume"]);
});

// Trava a FORMA dos params de ld e capa. Dois campos entraram desde a versão
// original: `tituloCapa` (a capa não tinha título nenhum, e pedir "altere o
// título da capa" não tinha onde pousar) e `tomoInicial` nos dois (a numeração
// de tomos é do VOLUME: se outra disciplina já ocupou 01-03, aqui começa no 4).
test("normalizeProposals: forma dos params de ld e capa (regressão)", () => {
  const r = normalizeProposals(
    [
      { kind: "ld", tituloLd: "BLOCO B", numTomos: 2 },
      { kind: "capa", prefeitura: "Criciúma", volume: "3", numTomos: 2 },
    ],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal(r.length, 2);
  assert.deepEqual(r[0].params, {
    tituloLd: "BLOCO B",
    numTomos: 2,
    tomoInicial: 1, // não veio → contagem começa no 1, como sempre
  });
  assert.deepEqual(r[1].params, {
    templateId: "prefcri",
    tituloCapa: "", // não veio no pedido → decisão pendente, o Nexo pergunta
    volume: "3",
    numTomos: 2,
    tomoInicial: 1,
    // Não vieram no pedido → a capa sai com a data corrente, que é o que quem
    // não pediu data espera. O campo existir é o que faz o pedido CHEGAR.
    mes: "",
    ano: "",
  });
});

test("normalizeProposals: a DATA pedida chega nos params da capa", () => {
  // O defeito real: o engenheiro pedia "muda a data para maio de 2026", o slot
  // era preenchido, e a proposta saía sem os campos — a capa vinha com a data
  // de hoje e o pedido sumia sem aviso.
  const r = normalizeProposals(
    [{ kind: "capa", prefeitura: "Criciúma", mes: "5", ano: "2026" }],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal(r[0].params.mes, "5");
  assert.equal(r[0].params.ano, "2026");
});

// ---------------------------------------------------------------------------
// A prefeitura sai do CARIMBO — o campo que já era lido e não servia para nada
// ---------------------------------------------------------------------------

const selosDe = (cliente: string | null, quantas = 3) =>
  Array.from({ length: quantas }, () => ({ cliente }));

test("o órgão do carimbo escolhe o template sozinho", () => {
  // O caso real: 71 folhas dizendo "PREFEITURA MUNICIPAL DE CRICIÚMA", e o
  // Nexo perguntando de qual prefeitura era.
  const r = casarPrefeituraDoCarimbo(selosDe("PREFEITURA MUNICIPAL DE CRICIÚMA"), PREFS);
  assert.equal(r?.resolvedId, "prefcri");
  assert.equal(r?.plausibleCount, 1);
});

test("o órgão DOMINANTE vence: uma folha mal lida não arrasta o volume", () => {
  const selos = [
    ...selosDe("PREFEITURA MUNICIPAL DE CRICIÚMA", 9),
    { cliente: "PREFEITURA DE FLORIANÓPOLIS" },
  ];
  assert.equal(casarPrefeituraDoCarimbo(selos, PREFS)?.resolvedId, "prefcri");
});

test("casando com MAIS DE UM template, continua sendo pergunta", () => {
  // Mesma cidade com variantes: quem decide para quem o volume vai é uma pessoa.
  const r = casarPrefeituraDoCarimbo(selosDe("PREFEITURA MUNICIPAL DE CRICIÚMA"), [
    { id: "pmcriciuma", nome: "Criciúma — Padrão" },
    { id: "pmcriciuma2", nome: "Criciúma — Obras" },
  ]);
  assert.equal(r?.resolvedId, null);
  assert.equal(r?.plausibleCount, 2);
  assert.equal(r?.plausibles?.length, 2, "as duas viram chips");
});

/*
 * MUDOU O RETORNO, não o comportamento: antes devolvia `undefined` quando não
 * havia órgão nenhum; agora devolve o objeto com `motivo: "sem-evidencia"`. O
 * que importa segue igual — `resolvedId` null e `plausibleCount` 0 mantêm o slot
 * como pergunta —, e o motivo é justamente o que faltava para distinguir
 * "não li nada" de "li e não casou".
 */
test("carimbo sem órgão não inventa prefeitura", () => {
  const semOrgao = casarPrefeituraDoCarimbo(selosDe(null), PREFS);
  assert.equal(semOrgao?.resolvedId ?? null, null);
  assert.equal(semOrgao?.plausibleCount, 0);
  assert.equal(semOrgao?.motivo, "sem-evidencia");

  const semSelos = casarPrefeituraDoCarimbo([], PREFS);
  assert.equal(semSelos?.resolvedId ?? null, null);
  assert.equal(semSelos?.plausibleCount, 0);
  assert.equal(semSelos?.motivo, "sem-evidencia");
});

test("órgão que não casa com template nenhum vira pergunta, não erro", () => {
  const r = casarPrefeituraDoCarimbo(selosDe("PREFEITURA DE ALGUM LUGAR"), PREFS);
  assert.equal(r?.resolvedId, null);
  assert.equal(r?.plausibleCount, 0);
});

test("normalizeProposals: título de VÁRIAS LINHAS chega inteiro", () => {
  const r = normalizeProposals(
    [{ kind: "capa", prefeitura: "Criciúma", tituloCapa: "PROJETO ESTRUTURAL CONCRETO\n(TOMO 02)" }],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal(r[0].params.tituloCapa, "PROJETO ESTRUTURAL CONCRETO\n(TOMO 02)");
});

// O caso real: volume 6 já tem "Concreto" nos tomos 01-03; "Concreto
// Implantação" entra com mais 2, que precisam sair como 04 e 05.
test("normalizeProposals: tomoInicial atravessa ld e capa juntos", () => {
  const r = normalizeProposals(
    [
      { kind: "ld", tituloLd: "X", numTomos: 2, tomoInicial: 4 },
      { kind: "capa", prefeitura: "Criciúma", numTomos: 2, tomoInicial: 4 },
    ],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal((r[0].params as { tomoInicial: number }).tomoInicial, 4);
  assert.equal((r[1].params as { tomoInicial: number }).tomoInicial, 4);
});

test("normalizeProposals: tomoInicial invalido cai no 1 (nao quebra)", () => {
  const r = normalizeProposals(
    [
      { kind: "ld", numTomos: 1, tomoInicial: 0 },
      { kind: "ld", numTomos: 1, tomoInicial: "abc" },
    ],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal((r[0].params as { tomoInicial: number }).tomoInicial, 1);
  assert.equal((r[1].params as { tomoInicial: number }).tomoInicial, 1);
});

test("normalizeProposals: tituloCapa dito pelo engenheiro é copiado tal e qual", () => {
  const r = normalizeProposals(
    [
      {
        kind: "capa",
        prefeitura: "Criciúma",
        tituloCapa: "PROJETO ESTRUTURAL CONCRETO\nIMPLANTAÇÃO",
        volume: "6",
      },
    ],
    { disciplina: "EST", prefeituras: PREFS },
  );
  assert.equal(
    (r[0].params as { tituloCapa: string }).tituloCapa,
    "PROJETO ESTRUTURAL CONCRETO\nIMPLANTAÇÃO",
    "título multilinha chega inteiro, sem mistura com o anterior",
  );
});

/*
 * A SEPARATRIZ CAÍA NA PRIMEIRA PREFEITURA CONFIGURADA.
 *
 * A capa foi endurecida contra isso — o comentário em `normalize.ts` conta o
 * volume de Criciúma que saiu como Florianópolis, e o `|| firstTemplateId` foi
 * removido dela. A separatriz ficou com a linha antiga: mesmo defeito, arquivo
 * seguinte, corrigido pela metade.
 *
 * `REAIS` está na ORDEM DE PRODUÇÃO, com Chapecó em primeiro. Com Criciúma em
 * primeiro estes testes passariam VERDES com o defeito intacto — e é exatamente
 * assim que ele sobreviveu à correção do irmão dele.
 */
test("prefeitura não decidida NÃO vira Chapecó na separatriz", () => {
  const r = normalizeProposals(
    [{ kind: "capa" }, { kind: "separatriz" }],
    { prefeituras: REAIS, disciplina: "METALICA" } as never,
  );
  const capa = r.find((p) => p.kind === "capa")?.params as { templateId: string };
  const sep = r.find((p) => p.kind === "separatriz")?.params as { templateId: string };
  assert.equal(capa.templateId, "", "capa sem prefeitura decidida fica vazia");
  assert.equal(sep.templateId, "", "separatriz sem prefeitura decidida TAMBÉM fica vazia");
});

test("a separatriz continua no plano, travada — não some", () => {
  const r = normalizeProposals(
    [{ kind: "separatriz" }],
    { prefeituras: REAIS, disciplina: "METALICA" } as never,
  );
  assert.equal(r.length, 1, "sumir esconderia que o volume tem uma separatriz");
});

test("capa e separatriz saem SEMPRE com a mesma prefeitura", () => {
  /*
   * O pedido nomeia a prefeitura só na CAPA: a separatriz herda a MESMA
   * decisão. Duas resoluções independentes do mesmo fato é o que produz um
   * volume com capa de Criciúma e separatriz de Chapecó.
   */
  const r = normalizeProposals(
    [
      { kind: "capa", prefeitura: "Prefeitura Municipal de Criciúma" },
      { kind: "separatriz" },
    ],
    { prefeituras: REAIS, disciplina: "METALICA" } as never,
  );
  const capa = r.find((p) => p.kind === "capa")?.params as { templateId: string };
  const sep = r.find((p) => p.kind === "separatriz")?.params as { templateId: string };
  assert.equal(capa.templateId, "pmcriciuma");
  assert.equal(sep.templateId, "pmcriciuma");
});

test("sem prefeitura CONFIGURADA não há capa nem separatriz", () => {
  const r = normalizeProposals(
    [{ kind: "capa" }, { kind: "separatriz" }],
    { prefeituras: [], disciplina: "METALICA" } as never,
  );
  assert.equal(r.length, 0);
});

/*
 * A SECRETARIA TAMBÉM NOMEIA UM ÓRGÃO — medido, não suposto.
 *
 * `npm run mede:prefeitura` sobre 40 LDs entregues: 28 cravaram, 12 não, e as
 * doze pelo MESMO motivo (`sem-evidencia`) no MESMO projeto. O 040-26 nomeia a
 * SECRETARIA em todo documento e nunca escreve "prefeitura"; `nomeiaOrgao`
 * exigia `prefeitura|municipio|governo`, então o texto trazia "CHAPECÓ" por
 * extenso e o casamento recusava.
 *
 * "municipal" NÃO entra na lista: "Feira Municipal de Chapecó" é o nome de um
 * lugar, não de um órgão, e aceitá-lo abriria de novo o caminho que o caso
 * Florianópolis fechou. O que nomeia órgão aqui é a SECRETARIA.
 */
const RODAPE_DO_040_26 =
  "SECRETARIA DE DESENVOLVIMENTO SUSTENTÁVEL E OBRAS ESTRUTURANTES - SEDES – " +
  "040_26 – REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ – PROJETO EXECUTIVO";

test("a SECRETARIA emissora nomeia órgão e crava a prefeitura", () => {
  assert.equal(matchPrefeitura({ nome: RODAPE_DO_040_26 }, REAIS)?.id, "prefchap");
});

test("aceitar SECRETARIA não reabre o caso Florianópolis", () => {
  /*
   * A GUARDA QUE NÃO PODE CAIR. O endereço da PROSUL está impresso em todas as
   * pranchas e cita Florianópolis; foi ele que fez um volume de Criciúma sair
   * como Florianópolis. Ele não contém "secretaria" — e este teste é o que
   * garante que continua assim depois da mudança.
   */
  assert.equal(matchPrefeitura({ nome: ENDERECO_DA_PROSUL }, REAIS), null);
  assert.equal(
    matchPrefeitura({ nome: `${ENDERECO_DA_PROSUL} SECRETARIA DE OBRAS` }, REAIS, {
      nome: "PROSUL",
      enderecoImpresso: "Rua Saldanha Marinho, 110, Centro - Florianópolis - SC",
      municipio: "Florianópolis",
      uf: "SC",
    }),
    null,
    "com o escritório declarado, a linha dele sai antes de casar",
  );
});

test("secretaria sem cidade nenhuma não inventa prefeitura", () => {
  assert.equal(
    matchPrefeitura({ nome: "SECRETARIA DE DESENVOLVIMENTO SUSTENTÁVEL - SEDES" }, REAIS),
    null,
  );
});

test("o carimbo que só nomeia a secretaria crava pelo texto", () => {
  const r = casarPrefeituraDoCarimbo(
    [{ cliente: RODAPE_DO_040_26 }, { cliente: RODAPE_DO_040_26 }],
    REAIS,
  );
  assert.equal(r?.resolvedId, "prefchap");
  assert.equal(r?.motivo, "so-texto");
});

console.log(`\n${passed} teste(s) passaram.`);
