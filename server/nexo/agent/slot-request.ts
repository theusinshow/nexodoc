/**
 * Pós-processamento DETERMINÍSTICO do turno: dado o que a IA propôs, decide se
 * ainda falta uma DECISÃO humana e monta o `NexoSlotRequest` (§3 da ARQUITETURA.md).
 * A máquina de "o que falta" é o `SlotResolver` puro — a IA não participa desta
 * decisão. Aqui só a alimentamos e escolhemos o 1º artefato com pendência.
 *
 * Sem C4 (o cliente ainda não re-envia o estado de slots): os PARÂMETROS que a IA
 * extraiu na proposta SÃO os slots já preenchidos. Título vazio no `ld` → o
 * resolver acusa `tituloLd` faltante e devolve as sugestões determinísticas de
 * requirements.ts (título-do-selo, `PROJETO <disciplina>`, variação c/ obra) como
 * chips `fill`. Quando o dossiê do intake entrar no corpo (C4/PR5), estas mesmas
 * peças recebem contexto mais rico sem reescrita.
 *
 * Contexto de rota (Node): pode importar runtime. As sugestões de título usam os
 * selos CRUS (mode de `tituloSecao`), por isso o cálculo vive na rota, que os tem.
 */
import type {
  NexoAgentProposal,
  NexoSlotRequest,
} from "@/modules/nexo/types";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import type { SlotId, SlotState } from "@/modules/nexo/state/session-reducer";

import { ARTIFACT_REQUIREMENTS, type SlotFacts } from "./requirements";
import { resolveSlots } from "./slot-resolver";
// O casamento cidade→template mora em `normalize.ts`, junto de `matchPrefeitura`
// que é a sua única dependência — e lá ele roda em node cru, com teste.
import { casarPrefeituraDoCarimbo } from "./normalize";
import type { DadosDoEscritorio } from "@/lib/escritorio";
// A data mora num módulo puro só dela; o léxico de disciplinas é a FONTE ÚNICA
// dos três nomes de cada disciplina. Os dois são import de runtime, e por isso
// entram aqui e não em `requirements.ts`, que é folha pura.
import { dataDominante } from "@/server/nexo/data-do-selo";
import { nomeNaCapa } from "@/server/nexo/disciplinas";

export interface SlotRequestContext {
  /** Selos crus lidos das pranchas (base das sugestões de título). */
  selos: SeloForLd[];
  /** Disciplina detectada (chave do seloSet + rótulo). */
  disciplina: string;
  /** Código canônico de três letras ("est") — a chave do léxico de disciplinas. */
  disciplinaCode?: string;
  /** Obra detectada (entra no dossiê mínimo). */
  obra: string;
  /** Prefeituras configuradas (chips de templateId, se faltar). */
  prefeituras: { id: string; nome: string }[];
  /**
   * Quem EMITE — o endereço impresso na prancha, que não é o cliente. Injetado
   * pela rota (vem do banco/ambiente); ausente, o casamento é o de sempre.
   */
  escritorio?: DadosDoEscritorio;
  /** Mês/ano de referência, injetados pela rota (função pura não chama `new Date`). */
  mesAtual: number;
  anoAtual: number;
  /**
   * Divisão em tomos recomendada para as folhas em contexto. Injetada pela rota
   * pelo mesmo motivo da data: a regra vive em `sugerirNumeroDeTomos`
   * (`lib/ld/ld-rules`), que é import de runtime, e este arquivo é puro.
   */
  tomosSugeridos: number;
  /**
   * O que o engenheiro já decidiu no FRAME do documento (título, volume, data,
   * tomos, prefeitura). Entra como slot PREENCHIDO.
   *
   * Sem isto o Nexo volta a perguntar no chat o título que ele acabou de
   * digitar no card — o oposto do que o frame existe para fazer.
   */
  decisoes?: Record<string, string>;
}

/**
 * Monta o mapa de slots JÁ preenchidos a partir dos params da proposta. Valores
 * vazios/omitidos ficam de fora → o resolver os trata como faltantes. Sem C4,
 * este é o único "estado de slots" que o servidor conhece.
 */
function slotsFromProposal(p: NexoAgentProposal): Record<SlotId, SlotState> {
  const slots: Record<SlotId, SlotState> = {};
  const put = (id: string, v: string | number | undefined) => {
    const s = v == null ? "" : String(v).trim();
    if (s) slots[id] = { value: s };
  };
  switch (p.kind) {
    case "ld":
      put("tituloLd", p.params.tituloLd);
      put("numTomos", p.params.numTomos);
      put("tomoInicial", p.params.tomoInicial);
      break;
    case "capa":
      put("templateId", p.params.templateId);
      put("tituloCapa", p.params.tituloCapa);
      put("volume", p.params.volume);
      put("numTomos", p.params.numTomos);
      put("tomoInicial", p.params.tomoInicial);
      // Sem estes dois, a data que o engenheiro já deu era perguntada de novo a
      // cada turno — e a resposta não tinha para onde ir.
      put("mes", p.params.mes);
      put("ano", p.params.ano);
      break;
    case "separatriz":
      put("templateId", p.params.templateId);
      put("numTomos", p.params.numTomos);
      break;
    case "auditoria":
      put("nivel", p.params.nivel);
      break;
    // conferencia | volume: sem slots de decisão (§3).
  }
  return slots;
}

/**
 * Retorna o `slotRequest` do turno: o 1º artefato proposto que ainda tem um
 * required faltante dita a pergunta. `undefined` se tudo já está resolvido (o
 * caso comum quando a IA preencheu os params) — o cliente então não renderiza chips.
 */
export function buildSlotRequestForTurn(
  proposals: NexoAgentProposal[],
  ctx: SlotRequestContext,
): NexoSlotRequest | undefined {
  if (proposals.length === 0) return undefined;

  const key = ctx.disciplina.trim() || "GERAL";
  const casamento = casarPrefeituraDoCarimbo(ctx.selos, ctx.prefeituras, ctx.escritorio);

  /*
   * POR QUE A PREFEITURA FOI (ou não) RESOLVIDA — no log do servidor.
   *
   * "Perguntou a prefeitura de novo" era indistinguível de "não leu órgão
   * nenhum", "leu e não casou com template" e "casou com dois". As três pedem
   * correções diferentes, e sem o motivo a próxima melhoria seria palpite.
   *
   * Só quando NÃO resolve: o caso bom não precisa de linha de log, e um log por
   * turno em conversa longa vira ruído que ninguém lê.
   */
  if (casamento && !casamento.resolvedId) {
    console.info(
      `[nexo] prefeitura não resolvida — motivo=${casamento.motivo} ` +
        `plausiveis=${casamento.plausibleCount} folhas=${ctx.selos.length}`,
    );
  }

  const facts: SlotFacts = {
    dossie: {
      id: "",
      disciplinas: ctx.disciplina.trim() ? [ctx.disciplina.trim()] : [],
      obra: ctx.obra.trim()
        ? { value: ctx.obra.trim(), origem: "extraido", confirmado: false }
        : undefined,
      arquivos: [],
      artefatos: [],
    },
    seloSets: { [key]: ctx.selos },
    prefeituras: ctx.prefeituras,
    /*
     * O ÓRGÃO QUE O CARIMBO JÁ DISSE escolhe o template.
     *
     * `templateMatch` era consumido por `templateIdSlot`, testado, documentado —
     * e nunca calculado em produção. Sem ele, `deriveFrom` devolvia null e a
     * prefeitura virava pergunta obrigatória em TODA conversa, mesmo com o selo
     * de 71 pranchas gritando "PREFEITURA MUNICIPAL DE CRICIÚMA".
     *
     * O casamento é `matchPrefeitura`, o mesmo que a proposta do agente usa —
     * fonte única. Casou UMA: resolve sozinho. Casou nenhuma ou mais de uma:
     * continua sendo pergunta, com as plausíveis como chips. Ambiguidade aqui é
     * o caso do volume ir para a prefeitura errada, e ele não se adivinha.
     *
     * Duas evidências desde então: o nome escrito e o BRASÃO. Divergirem entre
     * si também é pergunta — ver `casarPrefeituraDoCarimbo`.
     */
    templateMatch: casamento,
    /*
     * A DATA e os TÍTULOS que o carimbo já respondeu.
     *
     * Computados aqui pelo mesmo motivo de `templateMatch`: `requirements.ts` é
     * folha pura e não pode importar runtime. `undefined` quando não há o que
     * derivar — nenhuma folha com data legível, empate entre folhas, ou
     * disciplina desconhecida —, e aí o slot volta a ser perguntável em vez de
     * o software inventar um valor.
     */
    dataDoSelo: dataDominante(ctx.selos.map((s) => s.data)) ?? undefined,
    /*
     * O CÓDIGO, não o rótulo. `ctx.disciplina` é "ESTRUTURAL" (de UI) e
     * `nomeNaCapa("ESTRUTURAL")` devolve undefined — passá-lo aqui daria título
     * vazio em SILÊNCIO, com o slot voltando a perguntar como se nada tivesse
     * mudado. A chave do léxico é o código de três letras.
     */
    titulos: (() => {
      const code = (ctx.disciplinaCode ?? "").trim();
      if (!code) return undefined;
      // Capa e LD levam o MESMO nome; o longo e so da separatriz.
      const capa = nomeNaCapa(code);
      const ld = capa;
      return capa && ld ? { capa, ld } : undefined;
    })(),
    mesAtual: ctx.mesAtual,
    anoAtual: ctx.anoAtual,
    tomosSugeridos: ctx.tomosSugeridos,
  };

  for (const p of proposals) {
    const slots = slotsFromProposal(p);
    // A decisão do engenheiro vale como resposta dada: ela vem do frame, onde
    // ele acabou de digitar o campo que o resolvedor pediria de novo aqui.
    for (const [id, valor] of Object.entries(ctx.decisoes ?? {})) {
      const limpo = valor.trim();
      if (limpo) slots[id] = { value: limpo };
    }
    const { nextMissing } = resolveSlots({
      taskKind: p.kind,
      facts,
      slots,
      requirements: ARTIFACT_REQUIREMENTS,
    });
    if (nextMissing) return nextMissing;
  }
  return undefined;
}
