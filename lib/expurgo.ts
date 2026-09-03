/**
 * O QUE ENTRA NUM EXPURGO — a regra, sem banco e sem rede.
 *
 * O expurgo é o gesto mais destrutivo do produto: apaga conversa, auditoria,
 * achado, LD e os bytes guardados, de todos os donos, sem volta. Uma decisão
 * dessas não pode morar dentro de uma rota, onde só se prova com um banco
 * montado e dados de mentira — e onde, na prática, ninguém prova.
 *
 * Então a DECISÃO fica aqui, pura, e a EXECUÇÃO fica no serviço: aqui se
 * responde "quais conversas o alcance alcança?" e "esta palavra confirma?";
 * lá se apaga.
 *
 * PURO: nenhum import. Roda em node cru (`npm run test:expurgo`).
 */

/** A obra de uma conversa que o servidor não conseguiu endereçar. */
export const SEM_OBRA = "__sem-obra__";

export type Alcance =
  | { tipo: "selecao"; ids: readonly string[] }
  | { tipo: "obra"; chave: string }
  | { tipo: "tudo" };

export interface ConversaParaExpurgo {
  id: string;
  /** A identidade da obra. Ver [[nexodoc-identidade-do-projeto]]. */
  projectId: string | null;
  /** O cache de exibição, e o único endereço das conversas antigas. */
  folderKey: string | null;
}

/**
 * A CHAVE DA OBRA — `projectId` primeiro, `folderKey` só como sobra.
 *
 * A ordem não é estilo: `folderKey` era a identidade e virou cache, e é uma
 * string derivada no navegador. Agrupar por ela colocaria duas conversas do
 * mesmo projeto em obras diferentes se uma delas tivesse sido criada antes da
 * migração — e num expurgo por obra isso significa apagar metade e deixar a
 * outra metade, em silêncio.
 *
 * `SEM_OBRA` é legítimo, não é sujeira: é o memorial sem código no carimbo, e a
 * conversa que ainda não recebeu documento nenhum. Ele vira uma linha própria
 * na tela, e é expurgável como qualquer outra obra.
 */
export function chaveDaObra(conversa: ConversaParaExpurgo): string {
  if (conversa.projectId && conversa.projectId.trim()) return conversa.projectId.trim();
  if (conversa.folderKey && conversa.folderKey.trim()) return conversa.folderKey.trim();
  return SEM_OBRA;
}

/**
 * Quais conversas o alcance alcança.
 *
 * `selecao` filtra pelo que EXISTE: um id que não está na lista não vira
 * lápide. Gravar lápide para conversa que o servidor não conhece pareceria
 * inofensivo (é só uma linha), mas mandaria as máquinas apagarem um id que
 * talvez só exista no disco de alguém — apagando trabalho que o expurgo nunca
 * viu e nunca contou na prévia.
 */
export function conversasDoAlcance(
  conversas: readonly ConversaParaExpurgo[],
  alcance: Alcance,
): string[] {
  if (alcance.tipo === "tudo") {
    return conversas.map((conversa) => conversa.id);
  }

  if (alcance.tipo === "obra") {
    return conversas
      .filter((conversa) => chaveDaObra(conversa) === alcance.chave)
      .map((conversa) => conversa.id);
  }

  const pedidos = new Set(alcance.ids);

  return conversas.filter((conversa) => pedidos.has(conversa.id)).map((conversa) => conversa.id);
}

/**
 * As auditorias que estas conversas dispararam.
 *
 * O elo vive DENTRO do JSON da conversa (`data.auditorias[].auditId`) — não há
 * `Audit.conversationId` no schema. Isto é fato, não escolha desta função: a
 * auditoria se liga ao `Project`, e a conversa guarda o que ela mesma disparou.
 *
 * Recebe o `data` já lido para continuar puro. Tolera qualquer formato: o
 * registro é schemaless e cresce toda semana, e um expurgo que estoure no meio
 * por causa de um campo inesperado deixa o banco pela metade.
 */
export function auditoriasDasConversas(datas: readonly unknown[]): string[] {
  const ids = new Set<string>();

  for (const data of datas) {
    const auditorias = (data as { auditorias?: unknown } | null)?.auditorias;

    if (!Array.isArray(auditorias)) continue;

    for (const registro of auditorias) {
      const auditId = (registro as { auditId?: unknown })?.auditId;
      if (typeof auditId === "string" && auditId.trim()) ids.add(auditId.trim());
    }
  }

  return [...ids];
}

/**
 * A PALAVRA QUE LIBERA o botão.
 *
 * É o nome do ALVO, e não uma palavra genérica: "CONFIRMAR" digitado com a obra
 * errada selecionada confirma com o mesmo entusiasmo. O acidente que este
 * campo evita não é "apertei sem querer" — é "apertei o gesto certo no objeto
 * errado", que é o acidente que de fato acontece numa lista de obras parecidas.
 */
export function palavraDeConfirmacao(alcance: Alcance, rotuloDaObra?: string): string {
  if (alcance.tipo === "tudo") return "ZERAR TUDO";
  if (alcance.tipo === "obra") return rotuloDaObra?.trim() || alcance.chave;
  return "EXPURGAR SELECAO";
}

/**
 * Compara sem exigir perfeição de digitação.
 *
 * Acento fora, caixa fora, espaço repetido fora. "088-25 CRICIÚMA" não pode
 * depender de a pessoa acertar o acento — um campo que recusa a digitação certa
 * por causa de um til treina a pessoa a copiar e colar, e copiar e colar não
 * confirma nada.
 *
 * O que ele NÃO afrouxa: a palavra continua tendo que ser a do alvo.
 */
export function confirmacaoConfere(digitado: string, esperado: string): boolean {
  return normalizar(digitado) === normalizar(esperado) && normalizar(esperado).length > 0;
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    // A faixa dos diacríticos combinantes, escrita por código: os caracteres
    // literais aqui sobrevivem mal a copiar, colar e reencodar arquivo.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Quais bytes podem morrer: os que ninguém mais aponta.
 *
 * `StoredFile` é endereçado pelo CONTEÚDO (a chave primária é o checksum), então
 * o mesmo memorial usado em duas obras é UMA linha. Apagar os bytes junto com a
 * primeira obra apagaria o memorial da segunda — e o sintoma apareceria muito
 * depois, num "arquivo não encontrado" que ninguém liga ao expurgo de semanas
 * atrás.
 *
 * `aindaReferenciados` é o que sobrou apontando para lá DEPOIS de o resto ter
 * sido apagado. A ordem é parte da regra: perguntar antes daria sempre "todos
 * ainda são referenciados", e nada seria recolhido.
 */
export function checksumsOrfaos(
  candidatos: readonly string[],
  aindaReferenciados: readonly string[],
): string[] {
  const vivos = new Set(aindaReferenciados);

  return [...new Set(candidatos)].filter((checksum) => checksum && !vivos.has(checksum));
}
