/**
 * Trava o NÚCLEO DETERMINÍSTICO do padrão texto-não-formulário (§3 da
 * ARQUITETURA.md): o registro `ARTIFACT_REQUIREMENTS` + o `resolveSlots`. Ambos
 * são FOLHAS PURAS (só `import type`; o casamento de prefeitura chega
 * pré-computado em `facts.templateMatch`, o registro é injetado em `resolveSlots`),
 * então rodam no node cru com type-stripping:
 *
 *   node scripts/test-nexo-slots.ts   (== npm run test:nexo:slots)
 *
 * Cobre: LD sem/com título, capa pré-resolvida por município (plausibleCount:1)
 * vs. ambígua (0 ou >1), numTomos que nunca bloqueia, mês/ano determinísticos
 * (incl. virada de janeiro), nível da auditoria e os kinds sem slots
 * (volume/conferencia).
 */
import assert from "node:assert/strict";

import { resolveSlots } from "../server/nexo/agent/slot-resolver.ts";
import {
  ARTIFACT_REQUIREMENTS,
  type SlotFacts,
} from "../server/nexo/agent/requirements.ts";
import type { SeloForLd } from "../server/nexo/build-ld-proposal.ts";
import type { NexoArtifactKind, NexoDossie } from "../modules/nexo/types.ts";
import type { SlotState } from "../modules/nexo/state/session-reducer.ts";

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

// --- fixtures ---------------------------------------------------------------

const PREFS = [
  { id: "prefchap", nome: "Chapecó — Padrão" },
  { id: "prefflor", nome: "Florianópolis" },
  { id: "prefsj", nome: "São José" },
  { id: "prefsp", nome: "São Paulo do Sul" },
];

function dossie(over: Partial<NexoDossie> = {}): NexoDossie {
  return {
    id: "d1",
    disciplinas: ["estrutural"],
    arquivos: [],
    artefatos: [],
    obra: { value: "PONTE DO RIO", origem: "usuario", confirmado: true },
    ...over,
  };
}

function selo(over: Partial<SeloForLd> = {}): SeloForLd {
  return {
    fileName: "EST-001.pdf",
    pageNumber: null,
    disciplina: "estrutural",
    folha: 1,
    total: 10,
    numeroFolha: "01",
    arquivo: "EST-001",
    conteudo: null,
    cliente: null,
    secretaria: null,
    obra: "PONTE DO RIO",
    fase: "PROJETO EXECUTIVO",
    tituloSecao: null,
    ...over,
  };
}

/** Fatos base: data de referência e casamento de prefeitura INJETADOS. */
function facts(over: Partial<SlotFacts> = {}): SlotFacts {
  return {
    dossie: dossie(),
    seloSets: {},
    prefeituras: PREFS,
    mesAtual: 7,
    anoAtual: 2026,
    // Sem folhas no contexto, a divisão recomendada é 1 — é o que a rota
    // injetaria (`sugerirNumeroDeTomos(0)`).
    tomosSugeridos: 1,
    ...over,
  };
}

const noSlots: Record<string, SlotState> = {};

/** Injeta o registro (folha pura: `resolveSlots` não importa `ARTIFACT_REQUIREMENTS`). */
function resolve(args: {
  taskKind: NexoArtifactKind;
  facts: SlotFacts;
  slots: Record<string, SlotState>;
}) {
  return resolveSlots({ ...args, requirements: ARTIFACT_REQUIREMENTS });
}

// --- casos ------------------------------------------------------------------

// (a) LD sem título → nextMissing = tituloLd required com 2-3 suggestions
test("(a) LD sem título → nextMissing tituloLd (required, 2-3 chips), pronto:false", () => {
  const r = resolve({
    taskKind: "ld",
    facts: facts({
      seloSets: { estrutural: [selo({ tituloSecao: "PROJETO ESTRUTURAL" })] },
    }),
    slots: noSlots,
  });
  assert.equal(r.pronto, false);
  assert.ok(r.nextMissing, "esperava um nextMissing");
  assert.equal(r.nextMissing!.slotId, "tituloLd");
  assert.equal(r.nextMissing!.taskKind, "ld");
  assert.equal(r.nextMissing!.optional, false);
  const n = r.nextMissing!.suggestions.length;
  assert.ok(n >= 2 && n <= 3, `esperava 2-3 suggestions, veio ${n}`);
  /*
   * A 1ª é o título LIDO DO SELO e vai a UM CLIQUE (`send`); as outras escrevem
   * no composer para serem editadas (`fill`). O caso padrão — o carimbo já traz
   * o título certo — deixa de cobrar que se reescreva à mão o que o Nexo acabou
   * de mostrar. "Nunca auto-commitado" segue valendo: clicar é decidir.
   */
  assert.equal(r.nextMissing!.suggestions[0].value, "PROJETO ESTRUTURAL");
  assert.equal(r.nextMissing!.suggestions[0].commit, "send");
  assert.ok(
    r.nextMissing!.suggestions.slice(1).every((s) => s.commit === "fill"),
    "só a recomendada é de um clique",
  );
});

// (b) LD com título em slots → pronto:true
test("(b) LD com título em slots → pronto:true, sem nextMissing", () => {
  const r = resolve({
    taskKind: "ld",
    facts: facts(),
    slots: { tituloLd: { value: "BLOCO B" } },
  });
  assert.equal(r.pronto, true);
  assert.equal(r.nextMissing, null);
  assert.equal(r.resolved.tituloLd, "BLOCO B");
});

// (c) capa, casou 1 prefeitura por município (plausibleCount:1) → pré-resolvido.
// MUDOU: o título da capa virou decisão do engenheiro (como o da LD), então a
// prefeitura resolvida sozinha não deixa mais a capa pronta.
test("(c) capa, templateMatch.plausibleCount:1 → templateId pré-resolvido", () => {
  const r = resolve({
    taskKind: "capa",
    facts: facts({ templateMatch: { resolvedId: "prefflor", plausibleCount: 1 } }),
    slots: noSlots,
  });
  assert.equal(r.resolved.templateId, "prefflor", "casou por município");
  assert.equal(r.nextMissing?.slotId, "tituloCapa", "falta a decisão do título");
  assert.equal(r.pronto, false);
});

// (c2) capa com o título decidido → aí sim pronta
test("(c2) capa com tituloCapa decidido → pronto:true", () => {
  const r = resolve({
    taskKind: "capa",
    facts: facts({ templateMatch: { resolvedId: "prefflor", plausibleCount: 1 } }),
    slots: { tituloCapa: { value: "PROJETO ESTRUTURAL CONCRETO" } },
  });
  assert.equal(r.pronto, true);
  assert.equal(r.resolved.tituloCapa, "PROJETO ESTRUTURAL CONCRETO");
  /*
   * `pronto` e `nextMissing` deixaram de andar juntos. Com os required todos
   * resolvidos, o volume e a data ainda são PERGUNTADOS — sem travar o botão.
   * Antes eles sumiam em silêncio, e a capa saía com a data de hoje mesmo
   * depois de alguém pedir outra na conversa.
   */
  assert.equal(r.nextMissing?.slotId, "volume");
  assert.equal(r.nextMissing?.optional, true, "perguntável não bloqueia");
});

test("(c2b) o perguntável NUNCA passa na frente de um required", () => {
  // Sem título, a conversa tem de cuidar do título — não da data.
  const r = resolve({
    taskKind: "capa",
    facts: facts({ templateMatch: { resolvedId: "prefflor", plausibleCount: 1 } }),
    slots: noSlots,
  });
  assert.equal(r.nextMissing?.slotId, "tituloCapa");
  assert.equal(r.pronto, false);
});

test("(c2c) respondido o volume, a vez é da data — e o gerar segue liberado", () => {
  const r = resolve({
    taskKind: "capa",
    facts: facts({ templateMatch: { resolvedId: "prefflor", plausibleCount: 1 } }),
    slots: {
      tituloCapa: { value: "PROJETO ESTRUTURAL" },
      volume: { value: "5" },
    },
  });
  assert.equal(r.pronto, true);
  assert.equal(r.nextMissing?.slotId, "mes");
});

// (c3) o título NUNCA é auto-derivado — o palpite entra só como sugestão, e o
// nome do arquivo jamais vira título documental.
test("(c3) capa: título do selo vira SUGESTÃO, nunca valor; arquivo nunca entra", () => {
  const r = resolve({
    taskKind: "capa",
    facts: facts({
      templateMatch: { resolvedId: "prefflor", plausibleCount: 1 },
      seloSets: {
        estrutural: [selo({ tituloSecao: "PROJETO ESTRUTURAL CONCRETO", arquivo: "EST-001" })],
      },
    }),
    slots: noSlots,
  });
  assert.equal(r.resolved.tituloCapa, undefined, "não auto-commita o palpite");
  const chips = r.nextMissing?.suggestions ?? [];
  assert.ok(chips.length >= 2 && chips.length <= 3, "2-3 chips");
  assert.equal(chips[0]?.value, "PROJETO ESTRUTURAL CONCRETO", "título lido primeiro");
  assert.ok(
    !chips.some((c) => /EST-001/i.test(c.value)),
    "o nome do arquivo nunca é proposto como título",
  );
});

// (d) capa, >1 prefeitura plausível (plausibleCount:2) → templateId vira slot
test("(d) capa, templateMatch.plausibleCount:2 → templateId vira slot, pronto:false", () => {
  const r = resolve({
    taskKind: "capa",
    facts: facts({
      templateMatch: {
        resolvedId: null,
        plausibleCount: 2,
        plausibles: [
          { id: "prefsj", nome: "São José" },
          { id: "prefsp", nome: "São Paulo do Sul" },
        ],
      },
    }),
    slots: noSlots,
  });
  assert.equal(r.pronto, false);
  assert.ok(r.nextMissing);
  assert.equal(r.nextMissing!.slotId, "templateId");
  // as suggestions listam as prefeituras plausíveis pré-computadas.
  const ids = r.nextMissing!.suggestions.map((s) => s.value);
  assert.deepEqual(ids.sort(), ["prefsj", "prefsp"]);
});

// (d2) capa, nenhuma prefeitura casada (plausibleCount:0) → templateId vira slot
test("(d2) capa, templateMatch.plausibleCount:0 → templateId vira slot (chips = todas)", () => {
  const r = resolve({
    taskKind: "capa",
    facts: facts({ templateMatch: { resolvedId: null, plausibleCount: 0 } }),
    slots: noSlots,
  });
  assert.equal(r.pronto, false);
  assert.equal(r.nextMissing!.slotId, "templateId");
  // sem plausíveis pré-computadas → oferece todas as prefeituras configuradas.
  assert.equal(r.nextMissing!.suggestions.length, PREFS.length);
});

// (d3) capa sem templateMatch algum → também vira slot (não pré-resolve nada)
test("(d3) capa sem templateMatch → templateId vira slot", () => {
  const r = resolve({ taskKind: "capa", facts: facts(), slots: noSlots });
  assert.equal(r.pronto, false);
  assert.equal(r.nextMissing!.slotId, "templateId");
});

// (e) numTomos default 1 nunca bloqueia (required:false)
test("(e) numTomos default 1 nunca bloqueia; resolve pra '1' sozinho", () => {
  // capa com os dois required resolvidos (prefeitura + título) → numTomos, que é
  // opcional, não pode segurar o pronto sozinho.
  const r = resolve({
    taskKind: "capa",
    facts: facts({ templateMatch: { resolvedId: "prefflor", plausibleCount: 1 } }),
    slots: { tituloCapa: { value: "PROJETO ESTRUTURAL" } },
  });
  assert.equal(r.pronto, true, "numTomos required:false não segura o pronto");
  assert.equal(r.resolved.numTomos, "1", "default determinístico");
  // e o SlotDef de numTomos é mesmo opcional no registro.
  const def = ARTIFACT_REQUIREMENTS.capa.find((d) => d.id === "numTomos");
  assert.ok(def && def.required === false && def.decision === false);
  const sug = def!.suggest(facts());
  assert.equal(sug[0].value, "1", "a 1ª sugestão é a recomendada");
  assert.ok(sug.every((s) => s.commit === "fill"));
});

// (e2) o default deixou de ser 1: passou a ser a divisão RECOMENDADA
test("(e2) numTomos resolve para a divisão recomendada, não para 1", () => {
  /*
   * O caso real: 71 pranchas caíam em "1 tomo" até alguém digitar outro número —
   * um volume único que não se encaderna. `sugerirNumeroDeTomos(71)` dá 6, e é
   * esse número que a rota injeta.
   */
  const r = resolve({
    taskKind: "capa",
    facts: facts({
      templateMatch: { resolvedId: "prefflor", plausibleCount: 1 },
      tomosSugeridos: 6,
    }),
    slots: { tituloCapa: { value: "PROJETO ESTRUTURAL" } },
  });
  assert.equal(r.pronto, true, "continua sem segurar o pronto");
  assert.equal(r.resolved.numTomos, "6");
});

test("(e3) os chips oferecem o recomendado primeiro e os vizinhos depois", () => {
  const def = ARTIFACT_REQUIREMENTS.capa.find((d) => d.id === "numTomos")!;
  const sug = def.suggest(facts({ tomosSugeridos: 6 }));
  assert.equal(sug[0].value, "6", "o recomendado abre a lista");
  // Os vizinhos são onde a discordância cai; "1 tomo" continua alcançável.
  assert.deepEqual(sug.map((s) => s.value), ["6", "5", "7", "1"]);
});

test("(e4) recomendação 1 não oferece chip de zero tomos", () => {
  const def = ARTIFACT_REQUIREMENTS.capa.find((d) => d.id === "numTomos")!;
  const sug = def.suggest(facts({ tomosSugeridos: 1 }));
  assert.ok(sug.every((s) => Number(s.value) >= 1), sug.map((s) => s.value).join(","));
});

// (f) auditoria → nivel com suggestions standard/deep
test("(f) auditoria → nextMissing nivel com suggestions standard/deep", () => {
  const r = resolve({ taskKind: "auditoria", facts: facts(), slots: noSlots });
  assert.equal(r.pronto, false);
  assert.equal(r.nextMissing!.slotId, "nivel");
  const vals = r.nextMissing!.suggestions.map((s) => s.value);
  assert.deepEqual(vals, ["standard", "deep"]);
  // standard é a 1ª (recomendada), nunca auto-commitada (segue sendo pergunta).
  assert.equal(r.nextMissing!.suggestions[0].value, "standard");
});

// (f2) auditoria com nível escolhido → pronto:true
test("(f2) auditoria com nivel em slots → pronto:true", () => {
  const r = resolve({
    taskKind: "auditoria",
    facts: facts(),
    slots: { nivel: { value: "deep" } },
  });
  assert.equal(r.pronto, true);
  assert.equal(r.resolved.nivel, "deep");
});

// (g) a data é PERGUNTADA, não auto-resolvida — e os chips trazem o padrão
test("(g) capa: a data NÃO se auto-resolve; ela é perguntada", () => {
  /*
   * Era o defeito: `mes`/`ano` derivavam do relógio, o resolvedor os dava por
   * resolvidos e eles nunca viravam pergunta. A capa saía com a data de hoje —
   * inclusive depois de o engenheiro PEDIR outra data na conversa.
   *
   * Agora ficam em aberto até serem perguntados. Quem ignorar continua levando
   * o mês corrente, que é o padrão do BUILDER quando o campo chega vazio: a
   * derivação mudou de lugar, não sumiu.
   */
  const r = resolve({
    taskKind: "capa",
    facts: facts({
      templateMatch: { resolvedId: "prefflor", plausibleCount: 1 },
      mesAtual: 7,
      anoAtual: 2026,
    }),
    slots: { tituloCapa: { value: "X" }, volume: { value: "5" } },
  });
  assert.equal(r.resolved.mes, undefined, "não se auto-resolve mais");
  assert.equal(r.nextMissing?.slotId, "mes", "vira pergunta");
  assert.equal(r.pronto, true, "e mesmo assim não trava o gerar");

  // Os chips continuam oferecendo o mês corrente e o anterior — o padrão fica
  // a um clique, que é o que torna a pergunta barata.
  const mesDef = ARTIFACT_REQUIREMENTS.capa.find((d) => d.id === "mes")!;
  const sug = mesDef.suggest(facts({ mesAtual: 7, anoAtual: 2026 }));
  assert.deepEqual(sug.map((s) => s.value), ["7", "6"]); // julho + junho
});

test("(g3) a data DITA pelo engenheiro é respeitada e não é perguntada de novo", () => {
  const r = resolve({
    taskKind: "capa",
    facts: facts({ templateMatch: { resolvedId: "prefflor", plausibleCount: 1 } }),
    slots: {
      tituloCapa: { value: "X" },
      volume: { value: "5" },
      mes: { value: "3" },
      ano: { value: "2026" },
    },
  });
  assert.equal(r.resolved.mes, "3");
  assert.equal(r.resolved.ano, "2026");
  assert.equal(r.nextMissing, null, "nada mais a perguntar");
});

// (g2) virada de janeiro: mês anterior é dezembro do ano anterior
test("(g2) mês anterior de janeiro/2026 é dezembro/2025", () => {
  const mesDef = ARTIFACT_REQUIREMENTS.capa.find((d) => d.id === "mes")!;
  const anoDef = ARTIFACT_REQUIREMENTS.capa.find((d) => d.id === "ano")!;
  const f = facts({ mesAtual: 1, anoAtual: 2026 });
  assert.deepEqual(mesDef.suggest(f).map((s) => s.value), ["1", "12"]);
  assert.deepEqual(anoDef.suggest(f).map((s) => s.value), ["2026", "2025"]);
});

// (h) volume e conferencia: sem slots de decisão → pronto:true, nextMissing null
test("(h) volume/conferencia sem slots → pronto:true, nextMissing null", () => {
  for (const kind of ["volume", "conferencia"] as const) {
    const r = resolve({ taskKind: kind, facts: facts(), slots: noSlots });
    assert.equal(r.pronto, true, `${kind} deveria estar pronto`);
    assert.equal(r.nextMissing, null);
    assert.equal(ARTIFACT_REQUIREMENTS[kind].length, 0);
  }
});

// (i) fato NUNCA vira slot: título é decisão (deriveFrom null), mas prefeitura
//     casada é fato pré-computado (deriveFrom resolve) — a assimetria do §3.
test("(i) título nunca auto-deriva (decisão); prefeitura casada auto-resolve (fato)", () => {
  const tituloDef = ARTIFACT_REQUIREMENTS.ld.find((d) => d.id === "tituloLd")!;
  assert.equal(tituloDef.deriveFrom(facts()), null, "título nunca é adivinhado");
  assert.equal(tituloDef.decision, true);
  const tpl = ARTIFACT_REQUIREMENTS.capa.find((d) => d.id === "templateId")!;
  assert.equal(
    tpl.deriveFrom(facts({ templateMatch: { resolvedId: "prefflor", plausibleCount: 1 } })),
    "prefflor",
  );
  // >1 plausível não deriva (vira slot), mesmo com resolvedId sujo.
  assert.equal(
    tpl.deriveFrom(facts({ templateMatch: { resolvedId: "prefsj", plausibleCount: 2 } })),
    null,
  );
});

// (j) separatriz: mesmo padrão de templateId da capa (casa por município)
test("(j) separatriz com plausibleCount:1 → templateId pré-resolvido, pronto:true", () => {
  const r = resolve({
    taskKind: "separatriz",
    facts: facts({ templateMatch: { resolvedId: "prefflor", plausibleCount: 1 } }),
    slots: noSlots,
  });
  assert.equal(r.resolved.templateId, "prefflor");
  assert.equal(r.pronto, true);
});

console.log(`\n${passed} teste(s) passaram.`);
