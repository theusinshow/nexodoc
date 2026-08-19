/**
 * Agrupa as conversas da barra por PASTA — e a pasta é o PROJETO
 * (`084-25-CRICIUMA`). Núcleo puro (só `import type`) → testável com node cru.
 *
 * A v2 desenhava DUAS SEÇÕES no topo (montagem de volumes / auditoria de
 * memoriais) e pastas dentro de cada uma. O efeito é que o projeto aparecia em
 * DOIS lugares: o volume numa seção, a auditoria do memorial do mesmo projeto
 * na outra. Quem trabalha pensa "o 084-25", não "a parte de montagem do
 * 084-25".
 *
 * Agora há um nível só. O tipo de trabalho continua existindo, mas como
 * ETIQUETA: o filtro esconde ITENS dentro das pastas, e a pasta que fica sem
 * item visível some — pasta vazia na tela é ruído, não informação.
 */
import type { ConversationSummary, TipoDeTrabalho } from "./nexo-db.ts";
import { tipoDoResumo } from "./tipo-de-trabalho.ts";

export interface ConversationGroup {
  /** Chave da pasta (o projeto) ou null = "Sem pasta". */
  key: string | null;
  items: ConversationSummary[];
}

export function groupConversations(
  conversations: ConversationSummary[],
  query: string,
  /** Recorte por etiqueta. Ausente = tudo. */
  tipo?: TipoDeTrabalho,
): ConversationGroup[] {
  const q = query.trim().toLowerCase();
  const groups: ConversationGroup[] = [];
  const index = new Map<string, number>();

  for (const c of conversations) {
    if (tipo !== undefined && tipoDoResumo(c) !== tipo) continue;
    /*
     * A BUSCA COBRE O NOME DA PASTA, e não só o título.
     *
     * Procurar por "criciuma" tem de achar o projeto — e o nome do projeto NÃO
     * está mais no título da conversa, que agora é só "MET · HIS". Ele está na
     * pasta, que é justamente a mudança desta versão: sem isto, a refatoração
     * do histórico teria quebrado a busca que ela deveria melhorar.
     */
    if (
      q !== "" &&
      !c.title.toLowerCase().includes(q) &&
      !(c.folderKey ?? "").toLowerCase().includes(q)
    ) {
      continue;
    }

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

  /*
   * "Sem pasta" vai para o FIM, e a ordem das demais é preservada (a lista já
   * chega por recência). São as conversas cujo projeto ainda não se
   * identificou — sem código, ou sem prefeitura decidida. É trabalho em aberto,
   * não um projeto, e no topo empurraria os projetos reais para baixo.
   */
  return groups.sort((a, b) => (a.key === null ? 1 : 0) - (b.key === null ? 1 : 0));
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
