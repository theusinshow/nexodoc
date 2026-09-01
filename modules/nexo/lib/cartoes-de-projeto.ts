/**
 * A BARRA LATERAL É UMA LISTA DE PROJETOS — não de conversas.
 *
 * A lista de conversas mostrava quatro linhas "MET" idênticas na mesma pasta e
 * dezessete "Nova conversa" soltas: o rótulo não distinguia nada e a única
 * diferença visível era o horário. O projeto é a unidade que o escritório usa
 * (`084-25-CRICIUMA`), e é ele que vira cartão.
 *
 * AS TRÊS REGRAS DO CARTÃO, do desenho aprovado:
 *
 *   1. UM ABERTO POR VEZ. Abrir um fecha o outro — dois abertos não caberiam, e
 *      ninguém trabalha em dois projetos no mesmo minuto.
 *   2. O CARTÃO NUNCA ROLA POR DENTRO. Corta nas quatro conversas mais recentes
 *      e delega o resto ao palco. Rolagem dentro de rolagem é o que transforma
 *      uma barra em acordeão.
 *   3. FECHAR NÃO PERDE O LUGAR. O cartão do projeto em que se está fica aberto
 *      ao voltar; o estado é do PROJETO, não da sessão.
 *
 * A altura é previsível por construção: 59px fechado, 219px no máximo aberto.
 *
 * PURO e sem imports → roda em node cru (`npm run test:nexo:cartoes`).
 */

/** Uma conversa com o que o resumo do servidor apurou. */
export interface ConversaResumida {
  id: string;
  title: string;
  folderKey: string | null;
  /** O `Project` a que a conversa pertence. Nulo = a endereçar. */
  projectId: string | null;
  /** `063-26`, lido do projeto. Vazio quando não há vínculo. */
  projectCode: string;
  /** `CRICIÚMA`, lido do projeto. Vazio quando não há vínculo ou cliente. */
  projectClient: string;
  tipo: string | null;
  updatedAt: number;
  auditoriaPendente?: boolean;
  /** Folhas de prancha lidas nesta conversa. */
  folhas: number;
  /** Tipos de artefato gerados (`ld`, `capa`, `separatriz`, `volume`, ...). */
  kinds: readonly string[];
}

export interface ConversaDoCartao {
  id: string;
  /** "MET · EST" — as disciplinas, que é como a conversa se chama na pasta. */
  titulo: string;
  /** "volume", "separatriz", "auditoria", "leitura falhou" — o desfecho. */
  desfecho: string;
  updatedAt: number;
  rodando: boolean;
}

export interface CartaoDeProjeto {
  /** A pasta como está gravada; `""` é o trabalho sem código no carimbo. */
  chave: string;
  /** `084-25` — o contrato. Vazio quando a pasta não segue a convenção. */
  codigo: string;
  /** `CRICIUMA`. Vazio quando a pasta traz só o código (carimbo sem prefeitura). */
  cliente: string;
  atualizadoEm: number;
  /** Folhas somadas das conversas do projeto. */
  folhas: number;
  /** Os artefatos do projeto, na ordem do fluxo: LD, CAPA, SEP, VOL. */
  artefatos: string[];
  /** Alguma análise rodando agora neste projeto. */
  rodando: boolean;
  /** As mais recentes, no máximo `TETO_DE_CONVERSAS`. */
  conversas: ConversaDoCartao[];
  /** Quantas ficaram de fora do corte. */
  restantes: number;
  /** Desde quando são as que ficaram de fora. `0` quando não há. */
  restantesDesde: number;
}

/**
 * QUATRO, e o quinto vira uma linha.
 *
 * O corte é o que dá altura previsível ao cartão aberto. O nono item não é
 * rolagem: é "as outras 8 conversas · desde 04/07", que abre o projeto no palco,
 * onde há largura para doze.
 */
export const TETO_DE_CONVERSAS = 4;

/** A ordem do FLUXO, e não a alfabética: é assim que o documento nasce. */
const ORDEM_DOS_ARTEFATOS = ["ld", "capa", "separatriz", "volume", "auditoria", "conferencia"];

const ROTULO_CURTO: Record<string, string> = {
  ld: "LD",
  capa: "CAPA",
  separatriz: "SEP",
  volume: "VOL",
  auditoria: "AUDITORIA",
  conferencia: "CONFERÊNCIA",
};

/**
 * O DOCUMENTO FINAL de um projeto — o que ele entrega.
 *
 * A tela o pinta mais forte que os outros: numa fila de quatro etiquetas iguais,
 * "o volume ficou pronto" desaparece entre "gerei a LD" e "gerei a capa", e é a
 * única das quatro que responde se dá para mandar para a prefeitura.
 */
export function ehDocumentoFinal(artefato: string): boolean {
  return artefato === "VOL" || artefato === "AUDITORIA";
}

function normalizar(v: string): string {
  return v.trim().toLowerCase();
}

/** `084-25-CRICIUMA` → contrato e município. Ver `partesDaPasta` na home. */
function partes(chave: string): { codigo: string; cliente: string } {
  const comCliente = /^(\d{2,4}-\d{2})-(.+)$/.exec(chave.trim());
  if (comCliente) {
    return { codigo: comCliente[1], cliente: comCliente[2].replace(/[-_]+/g, " ").trim() };
  }
  /*
   * SÓ O CÓDIGO, sem município: é a pasta que a derivação ANTIGA gravava, e a
   * que nasce quando o carimbo não traz prefeitura. Ela existe de verdade na
   * barra (`084-25` ao lado de `084-25-CRICIUMA`), e o cartão diz isso em vez
   * de fingir que são projetos diferentes sem explicação.
   */
  const soCodigo = /^(\d{2,4}-\d{2})$/.exec(chave.trim());
  if (soCodigo) return { codigo: soCodigo[1], cliente: "" };
  return { codigo: "", cliente: "" };
}

/**
 * O DESFECHO da conversa, em uma palavra: o que ela produziu de mais adiantado.
 *
 * "leitura falhou" tem precedência sobre tudo — uma conversa que não conseguiu
 * ler o selo não é "uma LD a menos", é trabalho parado esperando alguém.
 */
function desfechoDa(c: ConversaResumida): string {
  if (c.folhas === 0 && c.kinds.length === 0) return "em branco";
  const tem = new Set(c.kinds.map(normalizar));
  if (tem.has("volume")) return "volume";
  if (tem.has("auditoria")) return "auditoria";
  if (tem.has("conferencia")) return "conferência";
  if (tem.has("separatriz")) return "separatriz";
  if (tem.has("capa")) return "capa";
  if (tem.has("ld")) return "LD";
  return `${c.folhas} folha${c.folhas === 1 ? "" : "s"} lidas`;
}

/**
 * Os cartões, do projeto mais recente para o mais antigo.
 *
 * SEM CÓDIGO NO CARIMBO vai para o fim, sempre. É onde caem as conversas que
 * ainda não têm identidade de projeto — as mais numerosas e as menos
 * informativas. No topo, empurrariam para baixo o projeto que a pessoa
 * reconheceria.
 */
export function cartoesDeProjeto(
  conversas: readonly ConversaResumida[],
): CartaoDeProjeto[] {
  const porPasta = new Map<string, ConversaResumida[]>();
  for (const c of conversas) {
    const chave = (c.folderKey ?? "").trim();
    const lista = porPasta.get(chave);
    if (lista) lista.push(c);
    else porPasta.set(chave, [c]);
  }

  const cartoes: CartaoDeProjeto[] = [];

  for (const [chave, doProjeto] of porPasta) {
    const ordenado = [...doProjeto].sort((a, b) => b.updatedAt - a.updatedAt);
    const tipos = new Set<string>();
    let folhas = 0;
    let rodando = false;

    for (const c of ordenado) {
      folhas += c.folhas;
      if (c.auditoriaPendente) rodando = true;
      for (const k of c.kinds) tipos.add(normalizar(k));
    }

    const visiveis = ordenado.slice(0, TETO_DE_CONVERSAS);
    const cortadas = ordenado.slice(TETO_DE_CONVERSAS);
    const { codigo, cliente } = partes(chave);

    cartoes.push({
      chave,
      codigo,
      cliente,
      atualizadoEm: ordenado[0].updatedAt,
      folhas,
      artefatos: ORDEM_DOS_ARTEFATOS.filter((k) => tipos.has(k)).map(
        (k) => ROTULO_CURTO[k] ?? k.toUpperCase(),
      ),
      rodando,
      conversas: visiveis.map((c) => ({
        id: c.id,
        titulo: c.title,
        desfecho: desfechoDa(c),
        updatedAt: c.updatedAt,
        rodando: Boolean(c.auditoriaPendente),
      })),
      restantes: cortadas.length,
      // A data da MAIS ANTIGA das cortadas: "desde 04/07" diz o alcance do que
      // ficou escondido, e "desde ontem" diria o contrário do que se quer saber.
      restantesDesde: cortadas.length > 0 ? cortadas[cortadas.length - 1].updatedAt : 0,
    });
  }

  const comCodigo = cartoes.filter((c) => c.chave !== "");
  const semCodigo = cartoes.filter((c) => c.chave === "");
  comCodigo.sort((a, b) => b.atualizadoEm - a.atualizadoEm);

  return [...comCodigo, ...semCodigo];
}
