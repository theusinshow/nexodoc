/**
 * O alcance, lido do corpo do pedido.
 *
 * Separado das duas rotas que o usam (prévia e expurgo) porque elas TÊM que
 * concordar: se a prévia entendesse "obra" de um jeito e a execução de outro, o
 * número que a gaveta mostra não seria o número do que acontece — e é
 * exatamente essa confiança que a prévia existe para dar.
 */
import type { Alcance } from "@/lib/expurgo";

export function lerAlcance(corpo: unknown): Alcance | null {
  const alcance = (corpo as { alcance?: unknown } | null)?.alcance;
  const tipo = (alcance as { tipo?: unknown } | null)?.tipo;

  if (tipo === "tudo") return { tipo: "tudo" };

  if (tipo === "obra") {
    const chave = (alcance as { chave?: unknown }).chave;
    if (typeof chave !== "string" || !chave.trim()) return null;
    return { tipo: "obra", chave: chave.trim() };
  }

  if (tipo === "selecao") {
    const ids = (alcance as { ids?: unknown }).ids;
    if (!Array.isArray(ids)) return null;
    const limpos = ids.filter((id): id is string => typeof id === "string" && Boolean(id.trim()));
    /*
     * Seleção vazia é recusada, e não tratada como "nada a fazer": um corpo com
     * `ids: []` quase sempre é a tela mandando o que não tinha, e responder
     * "ok, apaguei nada" esconderia o defeito.
     */
    if (!limpos.length) return null;
    return { tipo: "selecao", ids: limpos };
  }

  return null;
}
