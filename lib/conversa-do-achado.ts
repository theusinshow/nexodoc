/**
 * A LINHA DO TEMPO DE UM ACHADO — o que as pessoas escreveram e o que o sistema
 * registrou, na MESMA cronologia.
 *
 * O histórico É a conversa, e isso é decisão de desenho. Duas tabelas — uma de
 * mensagens, outra de eventos — produziriam duas linhas do tempo que a tela
 * teria que fundir, e que poderiam discordar. Uma só entrega o que alguém quer
 * ler ao abrir um achado:
 *
 *   Victor atribuiu a Milton · "olha o item 14"
 *   Milton: isso é do estrutural, não meu
 *   Victor envolveu Carla
 *   Carla marcou como corrigido no documento
 *
 * Note a primeira: o recado do encaminhamento não é uma segunda funcionalidade,
 * é a primeira fala da conversa. Uma linha carrega as duas coisas — o que
 * aconteceu (`frase`) e o que a pessoa escreveu (`body`).
 *
 * PURO e sem imports → roda em node cru (`npm run test:conversa-achado`).
 */

/** Uma linha como o banco a devolve, já com o nome de quem falou resolvido. */
export type LinhaCrua = {
  kind: string;
  authorEmail: string;
  /** O nome que o escritório conhece. Vazio cai para o e-mail. */
  authorNome: string;
  body: string;
  details: Record<string, unknown> | null;
  createdAt: number;
};

export type LinhaLegivel = {
  kind: string;
  /** Quem fez ou falou. Nunca vazio. */
  quem: string;
  /** O que aconteceu, em português. Vazio no comentário puro. */
  frase: string;
  /** O que a pessoa escreveu. Pode conviver com `frase` — ver o docblock. */
  body: string;
  createdAt: number;
  ehEvento: boolean;
};

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * O nome de quem o evento aponta — o destinatário da atribuição, o envolvido.
 *
 * Cai para o e-mail, e depois para "alguém": a frase precisa fechar mesmo com
 * `details` de uma versão anterior que não gravava o nome.
 */
function alvo(details: Record<string, unknown> | null, prefixo: "para" | "de"): string {
  return texto(details?.[`${prefixo}Nome`]) || texto(details?.[prefixo]) || "alguém";
}

const DESFECHOS: Record<string, string> = {
  FIXED_IN_DOC: "marcou como corrigido no documento",
  FALSE_POSITIVE: "marcou como falso positivo",
  ACCEPTED_RISK: "assumiu o risco",
};

/**
 * A frase de um evento. `""` significa que a linha é fala pura.
 *
 * `kind` desconhecido devolve uma frase genérica em vez de vazio ou de erro: o
 * campo é texto e não enum de propósito (o vocabulário cresce sem migração), e
 * sumir com um pedaço do histórico é pior do que mostrá-lo sem frase bonita.
 */
function fraseDo(kind: string, details: Record<string, unknown> | null): string {
  switch (kind) {
    case "comentario":
      return "";
    case "atribuiu":
      return `atribuiu a ${alvo(details, "para")}`;
    case "reatribuiu":
      return `passou de ${alvo(details, "de")} para ${alvo(details, "para")}`;
    case "envolveu":
      return `envolveu ${alvo(details, "para")}`;
    case "desenvolveu":
      return `tirou ${alvo(details, "para")} dos envolvidos`;
    case "resolveu":
      return DESFECHOS[texto(details?.desfecho)] ?? "encerrou o achado";
    case "reabriu":
      return "reabriu o achado";
    default:
      return "registrou uma mudança";
  }
}

/**
 * As linhas em ordem cronológica, com a frase montada.
 *
 * A ordenação acontece AQUI, e não se confia na do banco: a consulta pode mudar,
 * e uma conversa fora de ordem conta uma história errada — "Carla corrigiu"
 * antes de "Victor atribuiu à Carla" inverte quem pediu o quê.
 */
export function linhaDoTempo(linhas: readonly LinhaCrua[]): LinhaLegivel[] {
  return [...linhas]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((l) => ({
      kind: l.kind,
      // Melhor um endereço do que uma linha sem dono — a mesma escolha que a
      // rota de feedback já faz para a tarja do responsável.
      quem: l.authorNome.trim() || l.authorEmail,
      frase: fraseDo(l.kind, l.details),
      body: l.body,
      createdAt: l.createdAt,
      ehEvento: l.kind !== "comentario",
    }));
}
