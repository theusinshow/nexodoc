/**
 * QUANTO CUSTA ENTREGAR UM PROJETO — a pergunta que o painel por fluxo não
 * responde.
 *
 * "Auditoria profunda: US$ 12,40" diz o que a máquina fez. O escritório precisa
 * do outro corte: "Residencial Aurora: US$ 31,80 em agosto", que é o número que
 * entra na proposta do próximo trabalho.
 *
 * O VÍNCULO JÁ EXISTIA e não estava sendo usado: `AiUsageEvent.conversationId`
 * é gravado desde o consumo por conversa, e a conversa carrega a pasta da obra
 * (`folderKey`). Não é etapa de schema — é uma junção que ninguém fez. (A spec
 * do A.7 previa que pudesse ser; conferido no código, não é.)
 *
 * O QUE NÃO TEM OBRA APARECE MESMO ASSIM. Evento sem conversa (auditoria fora
 * do Nexo, tarefa de manutenção) e conversa apagada viram linhas próprias, e é
 * deliberado: uma tabela que soma menos que o total do período faz o leitor
 * desconfiar do número certo. Ausência é fato, não sujeira a esconder.
 *
 * PURO: nenhum import. Roda em node cru (`npm run test:custo-por-obra`).
 */

export interface EventoDeConsumo {
  conversationId: string | null;
  estimatedCostUsd: number | null;
  totalTokens: number;
}

export interface ConversaConhecida {
  id: string;
  title: string;
  folderKey: string | null;
}

export interface CustoDaObra {
  /** Chave estável para React e para ordenar. */
  chave: string;
  /** O nome que aparece na tela. */
  obra: string;
  /** De onde saiu o nome: a pasta, a conversa avulsa, ou a falta de vínculo. */
  origem: "pasta" | "conversa" | "sem-vinculo" | "conversa-removida";
  estimatedCostUsd: number;
  totalTokens: number;
  requests: number;
  /** Quantas conversas entraram nesta linha. */
  conversas: number;
}

const SEM_VINCULO = "__sem-vinculo__";
const REMOVIDA = "__removida__";

/**
 * Agrupa o consumo por obra. `conversas` é o que a tabela de conversas trouxe
 * para o mesmo período — o que não estiver nela é tratado como removida, nunca
 * descartado.
 */
export function custoPorObra(
  eventos: readonly EventoDeConsumo[],
  conversas: readonly ConversaConhecida[],
): CustoDaObra[] {
  const porId = new Map(conversas.map((c) => [c.id, c]));
  const grupos = new Map<string, CustoDaObra & { idsDeConversa: Set<string> }>();

  for (const evento of eventos) {
    const conversa = evento.conversationId ? porId.get(evento.conversationId) : undefined;

    let chave: string;
    let obra: string;
    let origem: CustoDaObra["origem"];

    if (!evento.conversationId) {
      chave = SEM_VINCULO;
      obra = "sem vínculo com obra";
      origem = "sem-vinculo";
    } else if (!conversa) {
      chave = REMOVIDA;
      obra = "conversa removida";
      origem = "conversa-removida";
    } else if (conversa.folderKey?.trim()) {
      chave = `pasta:${conversa.folderKey.trim()}`;
      obra = conversa.folderKey.trim();
      origem = "pasta";
    } else {
      /*
       * Conversa fora de pasta é uma obra de uma conversa só. Some com a pasta
       * assim que ela for arquivada lá — e isso é a intenção: a pasta é a obra,
       * a conversa avulsa é o que ainda não foi arrumado.
       */
      chave = `conversa:${conversa.id}`;
      obra = conversa.title.trim() || "conversa sem título";
      origem = "conversa";
    }

    const grupo = grupos.get(chave) ?? {
      chave,
      obra,
      origem,
      estimatedCostUsd: 0,
      totalTokens: 0,
      requests: 0,
      conversas: 0,
      idsDeConversa: new Set<string>(),
    };

    grupo.estimatedCostUsd += evento.estimatedCostUsd ?? 0;
    grupo.totalTokens += evento.totalTokens;
    grupo.requests += 1;
    if (evento.conversationId) grupo.idsDeConversa.add(evento.conversationId);
    grupo.conversas = grupo.idsDeConversa.size;

    grupos.set(chave, grupo);
  }

  /*
   * As duas linhas sem obra vão para o FIM, independentemente do valor: a
   * tabela existe para comparar obras entre si, e uma linha "sem vínculo" cara
   * no topo empurraria as obras para baixo da dobra.
   */
  const semObra = (linha: CustoDaObra) =>
    linha.origem === "sem-vinculo" || linha.origem === "conversa-removida";

  return [...grupos.values()]
    .map(({ idsDeConversa: _ignorado, ...linha }) => linha)
    .sort((a, b) => {
      if (semObra(a) !== semObra(b)) return semObra(a) ? 1 : -1;
      return b.estimatedCostUsd - a.estimatedCostUsd;
    });
}
