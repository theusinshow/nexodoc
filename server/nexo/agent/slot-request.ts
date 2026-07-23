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

export interface SlotRequestContext {
  /** Selos crus lidos das pranchas (base das sugestões de título). */
  selos: SeloForLd[];
  /** Disciplina detectada (chave do seloSet + rótulo). */
  disciplina: string;
  /** Obra detectada (entra no dossiê mínimo). */
  obra: string;
  /** Prefeituras configuradas (chips de templateId, se faltar). */
  prefeituras: { id: string; nome: string }[];
  /** Mês/ano de referência, injetados pela rota (função pura não chama `new Date`). */
  mesAtual: number;
  anoAtual: number;
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
      break;
    case "capa":
      put("templateId", p.params.templateId);
      put("volume", p.params.volume);
      put("numTomos", p.params.numTomos);
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
    mesAtual: ctx.mesAtual,
    anoAtual: ctx.anoAtual,
  };

  for (const p of proposals) {
    const { nextMissing } = resolveSlots({
      taskKind: p.kind,
      facts,
      slots: slotsFromProposal(p),
      requirements: ARTIFACT_REQUIREMENTS,
    });
    if (nextMissing) return nextMissing;
  }
  return undefined;
}
