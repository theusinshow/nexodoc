/**
 * Reduz os MARCOS crus do motor à lista de etapas que a tela mostra.
 *
 * Módulo puro, sem React: a regra de "o que se pode afirmar agora" é a parte
 * que precisa de teste, e ela não depende de renderizar nada.
 *
 * Três decisões moram aqui:
 *  - passada que o motor não anunciou NÃO entra na lista. `blocos` e `confronto`
 *    nem sempre acontecem (no Profundo os blocos são cortados; com um arquivo só
 *    não há confronto), e mostrá-las apagadas prometeria trabalho inexistente;
 *  - o detalhe do FIM substitui o do início — contagem medida vale mais que
 *    orçamento previsto;
 *  - o começo de uma passada é o do PRIMEIRO marco dela. É contra ele que se
 *    mede o estouro do orçamento; medir contra o início da auditoria inteira
 *    acusaria atraso em documento grande onde nada está atrasado.
 */

import type { MarcoDaAuditoria, PassadaDaAuditoria } from "@/lib/audit-progress";

/** O marco, com a hora em que CHEGOU ao cliente. */
export type MarcoRecebido = MarcoDaAuditoria & { emMs: number };

export interface EtapaVista {
  passada: PassadaDaAuditoria;
  concluida: boolean;
  detalhe?: string;
  indice?: number;
  total?: number;
  orcamentoMs?: number;
  /** Quando esta passada começou — é contra ela que o orçamento é medido. */
  inicioMs: number;
}

/** A ordem em que o motor trabalha. */
const ORDEM: PassadaDaAuditoria[] = [
  "extracao",
  "regras",
  "global",
  "blocos",
  "evidencia",
  "confronto",
  "validacao",
  "parecer",
];

export function etapasDosMarcos(marcos: readonly MarcoRecebido[]): EtapaVista[] {
  const porPassada = new Map<PassadaDaAuditoria, EtapaVista>();
  for (const m of marcos) {
    const atual = porPassada.get(m.passada);
    porPassada.set(m.passada, {
      passada: m.passada,
      concluida: m.estado === "fim" || Boolean(atual?.concluida),
      detalhe: m.detalhe ?? atual?.detalhe,
      indice: m.indice ?? atual?.indice,
      total: m.total ?? atual?.total,
      orcamentoMs: m.orcamentoMs ?? atual?.orcamentoMs,
      inicioMs: atual?.inicioMs ?? m.emMs,
    });
  }
  return ORDEM.filter((p) => porPassada.has(p)).map((p) => porPassada.get(p)!);
}
