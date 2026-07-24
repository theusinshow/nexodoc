/**
 * Agrupa as conversas da sidebar por PASTA (código da obra), filtrando por
 * título. Núcleo puro (só `import type` → testável com node cru). Preserva a
 * ordem por recência (a lista já vem ordenada) e a ordem de aparição das pastas.
 */
import type { ConversationSummary } from "./nexo-db";

export interface ConversationGroup {
  /** Chave da pasta (código da obra) ou null = "Sem pasta". */
  key: string | null;
  items: ConversationSummary[];
}

export function groupConversations(
  conversations: ConversationSummary[],
  query: string,
): ConversationGroup[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? conversations.filter((c) => c.title.toLowerCase().includes(q))
    : conversations;
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
