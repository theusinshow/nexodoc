/**
 * Registro de REQUISITOS por artefato (§3 da ARQUITETURA.md — "Padrão
 * texto-não-formulário com pré-respostas de IA").
 *
 * A máquina de "o que falta" é DETERMINÍSTICA e vive aqui: cada `NexoArtifactKind`
 * declara os slots que precisa. Um slot é uma DECISÃO humana (`decision:true`) ou
 * um default determinístico (`decision:false`). Fatos do dossiê/selos NUNCA viram
 * slot — quando o valor é derivável dos fatos, `deriveFrom` o resolve e ele nunca
 * é perguntado. A IA só entra depois: redige o `prompt` e enriquece as
 * `suggestions` de linguagem (ex.: títulos). Aqui o `prompt` é um fallback curto
 * e as `suggestions` são as determinísticas/base.
 *
 * FOLHA PURA para rodar no `node` cru (`test:nexo:slots`): SÓ `import type` — zero
 * import de runtime (nem local nem `@/`). Segue a convenção dos demais arquivos
 * testáveis por node (normalize/session-reducer/light-check-core): o
 * type-stripping do node apaga os `import type` antes de resolver, então nada é
 * carregado em runtime. Sem `new Date()`, sem `Math.random()`: tudo que depende de
 * IO/estado externo (data de referência, resultado do casamento de prefeitura)
 * chega JÁ COMPUTADO no `SlotFacts` pelo chamador. `matchPrefeitura`/`clampTomos`
 * seguem FONTE ÚNICA em normalize.ts — o chamador (run-turn/route, que já importa
 * normalize) os roda e injeta o resultado aqui.
 */
import type { DisciplinaKey, SlotId } from "@/modules/nexo/state/session-reducer";
import type {
  NexoArtifactKind,
  NexoDossie,
  NexoSlotSuggestion,
} from "@/modules/nexo/types";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";

// ---------------------------------------------------------------------------
// Contexto de fatos agregados que alimenta as regras determinísticas
// ---------------------------------------------------------------------------

/**
 * Fatos agregados que as regras consomem para derivar/sugerir valores. Nenhum
 * deles vira slot — são o gabarito determinístico.
 *
 * `templateMatch` chega JÁ COMPUTADO: o chamador (que importa normalize.ts) roda
 * `matchPrefeitura` contra o município do dossiê e injeta o resultado — `resolvedId`
 * (o id casado, quando único) e `plausibleCount` (quantas prefeituras casaram
 * plausivelmente). Assim `matchPrefeitura` segue FONTE ÚNICA em normalize.ts e este
 * arquivo continua folha pura (§3 "deriva de município do dossiê"). `mesAtual`
 * (1-12) e `anoAtual` chegam prontos: a função é PURA e nunca chama `new Date()`.
 */
export interface SlotFacts {
  dossie: NexoDossie;
  seloSets: Record<DisciplinaKey, SeloForLd[]>;
  prefeituras: { id: string; nome: string }[];
  /**
   * Casamento de prefeitura por município, PRÉ-COMPUTADO pelo chamador via
   * `matchPrefeitura` (normalize.ts). `plausibleCount === 1` → casou uma só
   * (`resolvedId` preenchido, pré-resolve o slot); `0` ou `>1` → ambíguo, vira slot.
   */
  templateMatch?: {
    resolvedId: string | null;
    plausibleCount: number;
    /** Prefeituras plausíveis a oferecer como chips quando vira slot (opcional). */
    plausibles?: { id: string; nome: string }[];
  };
  /**
   * A data que o CARIMBO traz, dominante entre as folhas — já computada pelo
   * chamador (`dataDominante`, de `data-do-selo.ts`).
   *
   * Ausente quando nenhuma folha trouxe data legível OU quando houve EMPATE.
   * Nos dois casos o campo volta a ser perguntável, em vez de a capa sair com
   * uma data escolhida no cara ou coroa. Ver a cicatriz em `mesSlot`.
   */
  dataDoSelo?: { mes: number; ano: number; folhas: number; divergentes: number };
  /**
   * Os títulos derivados da DISCIPLINA, já computados pelo chamador
   * (`nomeNaCapa`/`nomeNaSeparatriz`, de `disciplinas.ts`).
   *
   * Chegam injetados pelo mesmo motivo de `templateMatch` e `tomosSugeridos`:
   * este arquivo é folha pura e `disciplinas.ts` é import de runtime. São dois
   * registros DIFERENTES do mesmo léxico — a capa diz "PROJETO ESTRUTURAL", o
   * documento diz "PROJETO DE ESTRUTURAS" —, e trocá-los faria a capa e a
   * separatriz do mesmo volume discordarem.
   */
  titulos?: { capa: string; ld: string };
  /** Mês de referência 1-12 (injetado — sem `new Date()` na função pura). */
  mesAtual: number;
  /** Ano de referência (injetado). */
  anoAtual: number;
  /**
   * Em quantos tomos as folhas em contexto DEVERIAM ser divididas — ~12 por
   * tomo, nunca menos de 9, nunca mais de 15, o mais parelho possível.
   *
   * Chega INJETADO pelo mesmo motivo de `mesAtual`: a regra mora em
   * `sugerirNumeroDeTomos` (`lib/ld/ld-rules`), que é import de RUNTIME, e este
   * arquivo é folha pura. Duplicar a conta aqui seria criar uma segunda verdade
   * sobre a divisão do volume.
   */
  tomosSugeridos: number;
}

/**
 * Definição de UM slot de um artefato.
 * - `required`  : bloqueia `pronto` enquanto não resolvido.
 * - `decision`  : true = decisão humana (título, nível); false = default
 *   determinístico (numTomos/mes/ano) que o resolver preenche sozinho.
 * - `deriveFrom`: valor determinístico a partir dos fatos, ou `null` se é preciso
 *   perguntar. Fatos NUNCA viram slot: é aqui que eles se auto-resolvem.
 * - `suggest`   : pré-respostas (chips). A 1ª é a recomendada — NUNCA
 *   auto-commitada. `commit:"fill"` escreve no composer; `commit:"send"` envia.
 * - `prompt`    : pergunta curta de fallback (a IA pode reescrever depois).
 * - `perguntarSeFaltar`: não-required que MESMO ASSIM é perguntado quando não
 *   há valor — depois de todos os required. É a terceira categoria: sem ela, o
 *   não-required sem `deriveFrom` sumia em silêncio, e foi assim que a data da
 *   capa nunca chegou a ser perguntada. Não segura o botão de gerar.
 */
export interface SlotDef {
  id: SlotId;
  taskKind: NexoArtifactKind;
  required: boolean;
  decision: boolean;
  /** Não-required que é perguntado mesmo assim, depois dos required. */
  perguntarSeFaltar?: boolean;
  prompt: string;
  deriveFrom(facts: SlotFacts): string | null;
  suggest(facts: SlotFacts): NexoSlotSuggestion[];
}

// ---------------------------------------------------------------------------
// Helpers PUROS, mínimos e locais (folha pura — sem import de runtime). A lógica
// de casamento de prefeitura NÃO vive aqui: chega pré-computada em
// `facts.templateMatch` (matchPrefeitura segue fonte única em normalize.ts).
// ---------------------------------------------------------------------------

/** Valor mais frequente (não-vazio) entre os selos. */
function mode(values: (string | null | undefined)[]): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    const s = v?.trim();
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) [best, bestN] = [k, n];
  return best;
}

/** Texto que é órgão/secretaria (OCR), não título técnico — descartado como sugestão. */
function isOrgaoLike(value: string): boolean {
  return /\b(secretaria|prefeitura|municipal|munic[íi]pio|departamento|sedes|gabinete|funda[çc][ãa]o|governo)\b/i.test(
    value,
  );
}

/** Todos os selos da sessão (achatando os conjuntos por disciplina). */
function allSelos(facts: SlotFacts): SeloForLd[] {
  return Object.values(facts.seloSets).flat();
}

/** Rótulo da disciplina (upper) do dossiê, com fallback nos selos. */
function disciplinaLabel(facts: SlotFacts): string {
  const fromDossie = facts.dossie.disciplinas[0];
  if (fromDossie && fromDossie.trim()) return fromDossie.trim().toUpperCase();
  const fromSelo = mode(allSelos(facts).map((s) => s.disciplina));
  return (fromSelo || "GERAL").toUpperCase();
}

/** Obra do dossiê, com fallback no modo dos selos. */
function obraDe(facts: SlotFacts): string {
  const fromDossie = facts.dossie.obra?.value?.trim();
  if (fromDossie) return fromDossie;
  return mode(allSelos(facts).map((s) => s.obra));
}

/** Exportado para o resumo do plano imprimir a data da capa por extenso. */
export const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Mês/ano anterior a (mês,ano). Janeiro volta pra dezembro do ano anterior. */
function mesAnterior(mes: number, ano: number): { mes: number; ano: number } {
  return mes <= 1 ? { mes: 12, ano: ano - 1 } : { mes: mes - 1, ano };
}

// ---------------------------------------------------------------------------
// Slots reutilizáveis
// ---------------------------------------------------------------------------

/**
 * `numTomos`: default determinístico "1", nunca bloqueia (`required:false`).
 * Sugestões estáticas 1-4 como conveniência (`fill`). Sem `clampTomos` (folha
 * pura sem import de runtime) — a normalização do valor digitado fica no chamador.
 */
function numTomosSlot(taskKind: NexoArtifactKind): SlotDef {
  return {
    id: "numTomos",
    taskKind,
    required: false,
    decision: false,
    prompt: "Dividir em quantos tomos?",
    /*
     * O default deixou de ser 1 e passou a ser a DIVISÃO RECOMENDADA.
     *
     * Um projeto de 71 pranchas caía em "1 tomo" até alguém digitar outro
     * número — um volume único que não se encaderna. A conta (~12 por tomo,
     * entre 9 e 15) é sempre a mesma e ninguém deveria ter de fazê-la de cabeça.
     * Continua sendo um palpite: os chips abaixo oferecem os vizinhos, e o
     * engenheiro troca com um clique.
     */
    deriveFrom: (facts) => String(Math.max(1, facts.tomosSugeridos)),
    suggest: (facts) => {
      const recomendado = Math.max(1, facts.tomosSugeridos);
      // O recomendado PRIMEIRO (a 1ª sugestão é a recomendada, por contrato), e
      // depois os vizinhos — que é onde a discordância costuma cair.
      const vizinhos = [recomendado, recomendado - 1, recomendado + 1, 1].filter(
        (n, i, todos) => n >= 1 && todos.indexOf(n) === i,
      );
      return vizinhos.slice(0, 4).map((n) => ({
        label: n === 1 ? "1 tomo" : `${n} tomos`,
        value: String(n),
        commit: "fill" as const,
      }));
    },
  };
}

/**
 * `tomoInicial`: a partir de qual tomo contar. NÃO é required — o padrão 1 vale
 * para a maioria dos documentos e não pode segurar a geração.
 *
 * Existe porque a numeração de tomos pertence ao VOLUME, não ao documento: num
 * volume de estrutural onde "Concreto" já ocupou 01-03, os tomos de "Concreto
 * Implantação" são 04 e 05. Sem isto a contagem reinicia e o volume fica com
 * dois "TOMO 01".
 *
 * O sistema NÃO consegue derivar isso sozinho hoje: cada conversa é uma
 * disciplina, e os tomos anteriores foram gerados em outra conversa. Por isso o
 * default é 1 e as sugestões são só um atalho — quem sabe é o engenheiro.
 */
function tomoInicialSlot(taskKind: NexoArtifactKind): SlotDef {
  return {
    id: "tomoInicial",
    taskKind,
    required: false,
    decision: true,
    prompt: "A partir de qual tomo? (o volume já tem tomos de outra disciplina?)",
    deriveFrom: () => "1", // default determinístico: começa no 1
    suggest: () =>
      [1, 2, 3, 4].map((n) => ({
        label: n === 1 ? "Começa no 1" : `Começa no ${n}`,
        value: String(n),
        commit: "fill" as const,
      })),
  };
}

/**
 * `templateId`: usa o casamento de prefeitura JÁ COMPUTADO pelo chamador
 * (`facts.templateMatch`, via `matchPrefeitura` em normalize.ts — fonte única).
 * `plausibleCount === 1` → casou uma só, PRÉ-RESOLVIDO (nunca perguntado);
 * `0` ou `>1` → ambíguo, vira slot (decisão humana). Sem `templateMatch`, também
 * vira slot.
 */
function templateIdSlot(taskKind: NexoArtifactKind): SlotDef {
  return {
    id: "templateId",
    taskKind,
    required: true,
    decision: true,
    prompt: "De qual prefeitura é o modelo da capa?",
    deriveFrom: (facts) => {
      const m = facts.templateMatch;
      return m && m.plausibleCount === 1 ? m.resolvedId : null;
    },
    suggest: (facts) => {
      // Oferece as plausíveis pré-computadas; senão todas as prefeituras.
      const plaus = facts.templateMatch?.plausibles;
      const opts = plaus && plaus.length ? plaus : facts.prefeituras;
      return opts.map((p) => ({
        label: p.nome,
        value: p.id,
        commit: "fill" as const,
      }));
    },
  };
}

/**
 * `mes`: derivado do CARIMBO; perguntado quando o carimbo não disser.
 *
 * A cicatriz: este `deriveFrom` já devolveu o mês CORRENTE, o que o
 * auto-resolvia e o fazia nunca chegar a ser pergunta. A capa saía com a data de
 * hoje e o engenheiro só descobria abrindo o PDF — inclusive depois de PEDIR
 * outra data na conversa. O `deriveFrom` foi então removido, e a data virou
 * pergunta em todo projeto.
 *
 * Agora ele volta, com a diferença que importa: a fonte é o DOCUMENTO, não o
 * relógio. Um volume montado hoje com pranchas de junho sai JUNHO — que é o que
 * o carimbo diz, e o que o engenheiro conferiria à mão de qualquer jeito.
 *
 * As duas condições andam JUNTAS e não podem ser separadas: derivar do selo
 * SEM exibir repetiria o defeito original com outra fonte. Quem exibe é o
 * `FrameDoDocumento`, que mostra a data como texto fantasma no campo em que ela
 * vai sair impressa. Sem data no carimbo (ou com empate entre folhas), volta a
 * ser perguntável e o builder cai no mês corrente.
 */
function mesSlot(taskKind: NexoArtifactKind): SlotDef {
  return {
    id: "mes",
    taskKind,
    required: false,
    decision: false,
    perguntarSeFaltar: true,
    prompt: "Qual mês vai na capa?",
    deriveFrom: (facts) =>
      facts.dataDoSelo ? String(facts.dataDoSelo.mes) : null,
    suggest: (facts) => {
      const prev = mesAnterior(facts.mesAtual, facts.anoAtual);
      return [
        { label: `${MESES_PT[facts.mesAtual - 1]} (atual)`, value: String(facts.mesAtual), commit: "fill" as const },
        { label: MESES_PT[prev.mes - 1], value: String(prev.mes), commit: "fill" as const },
      ];
    },
  };
}

/** `ano`: mesma fonte e mesmas regras do mês — os dois saem da mesma leitura. */
function anoSlot(taskKind: NexoArtifactKind): SlotDef {
  return {
    id: "ano",
    taskKind,
    required: false,
    decision: false,
    perguntarSeFaltar: true,
    prompt: "Qual ano vai na capa?",
    deriveFrom: (facts) =>
      facts.dataDoSelo ? String(facts.dataDoSelo.ano) : null,
    suggest: (facts) => [
      { label: `${facts.anoAtual} (atual)`, value: String(facts.anoAtual), commit: "fill" as const },
      { label: String(facts.anoAtual - 1), value: String(facts.anoAtual - 1), commit: "fill" as const },
    ],
  };
}

/**
 * `tituloLd`: DECISÃO do engenheiro (required, decision). Nunca auto-derivado —
 * "título é decisão, nunca adivinhar" (por isso `deriveFrom` é sempre `null`; o
 * palpite do selo entra só como SUGESTÃO, nunca auto-commitada). A IA reescreve
 * essas suggestions com linguagem melhor no PR de wiring; aqui a base é
 * determinística: título-lido do selo + `PROJETO <disciplina>` + variação c/ obra.
 */
/**
 * Candidatos a título documental, em ORDEM DE CONFIANÇA: o que foi lido do selo
 * (a fonte estruturada) > genérico da disciplina > variação com a obra.
 *
 * O `arquivo` do selo NUNCA entra: nome de arquivo não é título documental, é
 * como o arquivo foi salvo. Nomes de órgão também saem (`isOrgaoLike`) — a
 * prefeitura vai no cabeçalho da capa, não no título.
 *
 * Compartilhado pela LD e pela capa: as duas fazem a MESMA pergunta sobre as
 * MESMAS fontes, e duplicar a lista faria as duas divergirem com o tempo.
 */
function sugestoesDeTitulo(facts: SlotFacts): NexoSlotSuggestion[] {
  const disciplina = disciplinaLabel(facts);
  const obra = obraDe(facts);
  const doSelo = mode(
    allSelos(facts).map((s) =>
      s.tituloSecao && !isOrgaoLike(s.tituloSecao) ? s.tituloSecao : null,
    ),
  );
  const candidatos = [
    doSelo,
    `PROJETO ${disciplina}`,
    obra ? `${disciplina} — ${obra}` : `MEMORIAL ${disciplina}`,
  ];
  const vistos = new Set<string>();
  const out: NexoSlotSuggestion[] = [];
  for (const c of candidatos) {
    const v = c.trim();
    const key = v.toLowerCase();
    if (!v || vistos.has(key)) continue;
    vistos.add(key);
    /*
     * O PRIMEIRO candidato — o título lido do próprio selo — vai a UM CLIQUE
     * (`send`); os outros escrevem no composer para serem editados (`fill`).
     *
     * O título continua sendo decisão humana: clicar é decidir. O que muda é
     * que o caso padrão, em que o carimbo já traz o título certo, deixa de
     * cobrar que se reescreva à mão o que o Nexo acabou de mostrar. "Nunca
     * auto-commitado" segue valendo — nenhum título entra sem alguém clicar.
     */
    out.push({ label: v, value: v, commit: out.length === 0 ? "send" : "fill" });
  }
  return out.slice(0, 3);
}

/**
 * `tituloLd`: FATO derivado da disciplina, não decisão.
 *
 * Era `required` + `deriveFrom: () => null`, e por isso a conversa cobrava um
 * título antes de qualquer coisa — mesmo com o léxico de disciplinas sabendo
 * exatamente como aquela LD se chama, e mesmo com o carimbo de 24 pranchas
 * dizendo a disciplina. Perguntar o que já se sabe é o oposto de "afirma fatos,
 * pergunta decisões".
 *
 * Continua PERGUNTÁVEL quando não há disciplina de onde derivar, e quem quiser
 * outro título digita por cima: o valor dito à mão vence o derivado, como em
 * todo slot. O que deixou de existir é a cobrança no caso padrão.
 */
const tituloLdSlot: SlotDef = {
  id: "tituloLd",
  taskKind: "ld",
  required: false,
  decision: false,
  perguntarSeFaltar: true,
  prompt: "Qual o título desta LD?",
  deriveFrom: (facts) => facts.titulos?.ld ?? null,
  suggest: sugestoesDeTitulo,
};

/**
 * `tituloCapa`: FATO derivado da disciplina, pelas mesmas razões da LD.
 *
 * Usa o registro de CAPA do léxico ("PROJETO ESTRUTURAL"), que é mais curto que
 * o de documento usado pela LD ("PROJETO DE ESTRUTURAS"). Os dois saem da mesma
 * disciplina e não podem ser trocados: é o que mantém a capa e a separatriz do
 * mesmo volume falando a mesma língua.
 *
 * VOLUME MISTO: a regra de juntar uma linha por disciplina vive no card
 * (`PlanoDeGeracao`, via `derivados.TITULO_CAPA`), que conhece os blocos. Este
 * slot deriva de UMA disciplina; no misto, o card manda. Não duplicar a junção
 * aqui — o dia em que a regra mudar, ela tem de mudar num lugar só.
 */
const tituloCapaSlot: SlotDef = {
  id: "tituloCapa",
  taskKind: "capa",
  required: false,
  decision: false,
  perguntarSeFaltar: true,
  prompt: "Qual o título desta capa?",
  deriveFrom: (facts) => facts.titulos?.capa ?? null,
  suggest: sugestoesDeTitulo,
};

/*
 * O SLOT `nivel` FOI REMOVIDO EM 17/08/2026 — a auditoria tem um nível só.
 *
 * Ele perguntava "Qual a profundidade da auditoria?" com Padrão e Profunda. A
 * pergunta não tinha resposta errada porque não tinha trade-off: medidos no
 * 156-25 (150 páginas), os dois custavam os MESMOS US$ 0,82 — e o "Padrão"
 * amostrava 25% do documento e lia 8 dos 72 capítulos. Não era rápido-e-barato
 * contra lento-e-caro; era ler o documento contra não ler, pelo mesmo preço.
 *
 * Ninguém pede uma fiscalização mais ou menos. O nível único
 * (`NEXODOC_AUDIT_COBERTURA_TOTAL`) lê o documento inteiro e examina todos os
 * capítulos em blocos agrupados, e é o que a auditoria faz agora — sem
 * perguntar. `clampNivel` em [[normalize.ts]] continua existindo porque
 * conversas gravadas antes desta data trazem `nivel` no payload.
 *
 * Se um dia voltar a existir escolha, que ela seja entre coisas diferentes de
 * verdade (ex.: auditoria completa × reconferência só do que mudou), e não
 * entre duas doses da mesma coisa.
 */

/**
 * `volume`: o número do volume no conjunto do escritório ("VOLUME 05").
 *
 * Era o buraco do diálogo: o campo existe na capa, o builder o deriva do NOME DO
 * ARQUIVO quando vazio, e ninguém nunca era perguntado. Num projeto cujo arquivo
 * não carrega o volume, a capa saía sem ele e só se descobria abrindo o PDF.
 *
 * NÃO é required — a derivação pelo nome acerta na maioria e não pode segurar a
 * geração —, mas é PERGUNTADO: sem isso ele sumiria em silêncio, que é
 * exatamente o defeito que se está consertando. E não tem `deriveFrom`: o
 * número que o builder deduz do arquivo já cobre o caso comum, e cravar aqui um
 * palpite diferente criaria duas fontes para o mesmo campo.
 */
const volumeSlot: SlotDef = {
  id: "volume",
  taskKind: "capa",
  required: false,
  decision: true,
  perguntarSeFaltar: true,
  prompt: "Qual o número do volume?",
  deriveFrom: () => null,
  suggest: () =>
    [1, 2, 3, 4].map((n) => ({
      label: `Volume ${n}`,
      value: String(n),
      commit: "fill" as const,
    })),
};

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

/**
 * O QUE cada artefato precisa. `volume`/`conferencia` não têm decisão editável do
 * usuário na v1 (§3) — resolvem prontos sem slots. As pré-condições de fluxo do
 * volume (capa+separatriz+LD ready) vivem na guarda do reducer, não aqui.
 */
export const ARTIFACT_REQUIREMENTS: Record<NexoArtifactKind, SlotDef[]> = {
  ld: [tituloLdSlot, numTomosSlot("ld"), tomoInicialSlot("ld")],
  /*
   * A ORDEM importa: `resolveSlots` pergunta o PRIMEIRO que falta, então esta
   * lista é o roteiro da conversa. Ela vai do que não dá para adivinhar (a
   * prefeitura, o título) para o que quase sempre se deriva sozinho (a data) —
   * assim as perguntas que só o engenheiro responde vêm primeiro, e as que o
   * sistema resolve sozinho raramente chegam a ser feitas.
   */
  capa: [
    templateIdSlot("capa"),
    tituloCapaSlot,
    volumeSlot,
    numTomosSlot("capa"),
    tomoInicialSlot("capa"),
    mesSlot("capa"),
    anoSlot("capa"),
  ],
  separatriz: [templateIdSlot("separatriz"), numTomosSlot("separatriz")],
  // Sem slot nenhum: a auditoria não pergunta nada antes de rodar. A régua
  // (obra, prefeitura, município, centro de custo) já vem da classificação do
  // documento, e o nível deixou de existir — ver o bloco removido acima.
  auditoria: [],
  volume: [],
  conferencia: [],
};
