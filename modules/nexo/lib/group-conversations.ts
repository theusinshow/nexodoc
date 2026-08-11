/**
 * Agrupa as conversas da sidebar por PASTA (código da obra), filtrando por
 * título e, opcionalmente, por TIPO DE TRABALHO. Núcleo puro (só `import type`
 * → testável com node cru). Preserva a ordem por recência (a lista já vem
 * ordenada) e a ordem de aparição das pastas.
 *
 * O recorte por tipo vem por parâmetro, e não por um filtro depois: a sidebar
 * desenha DUAS seções, e cada uma precisa das suas pastas já separadas. Filtrar
 * o resultado do agrupamento devolveria pastas com itens dos dois trabalhos
 * dentro, que é justamente o que a v2 desfaz.
 */
import type { ConversationSummary, TipoDeTrabalho } from "./nexo-db.ts";
import { tipoDoResumo } from "./tipo-de-trabalho.ts";

export interface ConversationGroup {
  /** Chave da pasta (código da obra) ou null = "Sem pasta". */
  key: string | null;
  items: ConversationSummary[];
}

export function groupConversations(
  conversations: ConversationSummary[],
  query: string,
  /** Recorte por seção. Ausente = todas as conversas, como na v1. */
  tipo?: TipoDeTrabalho,
): ConversationGroup[] {
  const q = query.trim().toLowerCase();
  const filtered = conversations.filter(
    (c) =>
      (tipo === undefined || tipoDoResumo(c) === tipo) &&
      (q === "" || c.title.toLowerCase().includes(q)),
  );
  const groups: ConversationGroup[] = [];
  const index = new Map<string, number>();
  for (const c of filtered) {
    const key = c.folderKey ?? null;
    const mapKey = key ?? "__none__";
    let gi = index.get(mapKey);
    if (gi === undefined) {
      gi = groups.length;
      index.set(mapKey, gi);
      groups.push({ key, items: [] });
    }
    groups[gi].items.push(c);
  }
  return groups;
}

/**
 * Quantas conversas de cada tipo existem — a contagem ao lado do rótulo do
 * filtro.
 *
 * Conta a lista INTEIRA, sem busca e sem filtro: os números não mudam ao
 * filtrar, e é assim que se vê que existe trabalho do outro lado. Um contador
 * que zera junto com a seção que ele descreve não informa nada.
 */
export function contarPorTipo(conversations: ConversationSummary[]): {
  tudo: number;
  volume: number;
  auditoria: number;
} {
  let volume = 0;
  let auditoria = 0;
  for (const c of conversations) {
    if (tipoDoResumo(c) === "auditoria") auditoria++;
    else volume++;
  }
  return { tudo: conversations.length, volume, auditoria };
}
