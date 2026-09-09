/**
 * AS PREFERÊNCIAS DA HOME — o que cada pessoa escolheu ver, e em que ordem.
 *
 * PURO, sem imports e sem React: a leitura e a escrita são duas funções que
 * recebem/devolvem objeto, e o único acesso ao `localStorage` está atrás de um
 * `try` no fim do arquivo. É o que permite provar a migração de versão em node
 * cru, sem navegador.
 *
 * ONDE ISTO MORA, e por que não no banco.
 *
 * `localStorage`, e a escolha tem consequência que a tela precisa admitir:
 * quem trocar de máquina ou de navegador começa do padrão. A alternativa era
 * uma coluna `preferencias Json?` no `User` — melhor de verdade, e uma migração
 * a mais para um dado que não julga nada e não some se perder. O caminho está
 * aberto: `lerPreferencias`/`gravarPreferencias` são a fronteira inteira, e
 * trocar o armazém é reescrever as duas.
 *
 * A VERSÃO NÃO É ENFEITE. Preferência velha com widget que não existe mais
 * quebraria a Home inteira num `undefined.componente`. `normalizar` descarta o
 * que não reconhece e completa o que falta — toda leitura passa por ela,
 * inclusive a de um objeto que acabou de ser gravado.
 */

/** Sobe quando o formato muda de um jeito que a normalização não cobre. */
export const VERSAO_DAS_PREFERENCIAS = 1;

const CHAVE = "nexodoc:home:v1";

/* ────────────────────────────────────────────────────────────────────────────
 * O CATÁLOGO DE WIDGETS.
 *
 * Cada entrada é DADO, não componente: o registry das preferências não pode
 * importar React, senão o teste puro deixa de rodar em node. Quem casa o `id`
 * com o componente é `components/home/widgets/registro.tsx`, e o teste
 * `test:home-preferencias` cobra que as duas listas tenham os mesmos ids.
 *
 * O CRITÉRIO DE ENTRADA foi um só: o widget responde a uma pergunta do dia com
 * dado que EXISTE. Ficaram de fora, com o motivo escrito, os que exigiriam
 * inventar integração:
 *
 *  · "Meu dia", "Próxima reunião", "Próxima entrega" — não há modelo de tarefa
 *    nem de agenda no schema. Seriam três caixas com dado falso;
 *  · "Clima" — API externa e chave, para informação que não é do ofício;
 *  · "Calculadora" — o sistema operacional já tem uma, a dois atalhos. O
 *    `conversor` ficou no lugar dela porque converte o que ESTE ofício usa
 *    (mm/m, área, inclinação em % e em graus), que nenhuma calculadora faz.
 * ────────────────────────────────────────────────────────────────────────── */

export type TamanhoDeWidget = "curto" | "largo";

export type WidgetDoCatalogo = {
  id: string;
  nome: string;
  /** Uma linha no seletor. Diz o que ele MOSTRA, não o que ele é. */
  descricao: string;
  tamanho: TamanhoDeWidget;
  /**
   * De onde vem o que ele desenha. Vai para o seletor como legenda, porque a
   * diferença entre "isto é do escritório" e "isto vive só neste navegador"
   * muda o que a pessoa espera ao trocar de máquina.
   */
  fonte: "servidor" | "navegador" | "nenhuma";
};

export const CATALOGO: readonly WidgetDoCatalogo[] = [
  {
    id: "foco",
    nome: "Foco",
    descricao: "Temporizador de 25, 45 ou 60 minutos.",
    tamanho: "curto",
    fonte: "nenhuma",
  },
  {
    id: "rascunho",
    nome: "Rascunho",
    descricao: "Anotação rápida que sobrevive ao F5.",
    tamanho: "curto",
    fonte: "navegador",
  },
  {
    id: "atividade",
    nome: "Atividade do escritório",
    descricao: "O que as outras pessoas fizeram nos projetos.",
    /*
     * CURTO desde 09/09/2026. Ele era `largo` (duas colunas) e por isso ocupava
     * metade de uma seção que se chama SEU espaço — a maior peça de "seu
     * espaço" era a atividade dos outros. `largo` continua existindo no tipo
     * para o widget que vier precisar dele.
     */
    tamanho: "curto",
    fonte: "servidor",
  },
  {
    id: "conversor",
    nome: "Conversor de obra",
    descricao: "Comprimento, área, volume e inclinação (% · graus · 1:X · mm/m).",
    tamanho: "curto",
    fonte: "nenhuma",
  },
  {
    id: "artefatos",
    nome: "Gerados recentemente",
    descricao: "Os últimos volumes, capas e LDs que você tirou.",
    tamanho: "curto",
    fonte: "servidor",
  },
] as const;

export const IDS_DO_CATALOGO = CATALOGO.map((w) => w.id);

export type EscopoDaLista = "meus" | "todos";

export type PreferenciasDaHome = {
  versao: number;
  /** Ids ligados, NA ORDEM em que aparecem. A ordem é a lista, não um campo. */
  widgets: string[];
  /** A faixa de contadores. Quem não a quer não a vê, e a lista sobe. */
  mostrarAtencao: boolean;
  /** Quantos projetos a lista desenha antes do "Ver todos". */
  projetosVisiveis: number;
  escopo: EscopoDaLista;
  ordem: string;
};

/**
 * O PADRÃO — três widgets, e não cinco.
 *
 * `conversor` e `artefatos` nascem desligados porque a primeira Home de alguém
 * não pode ser uma parede de caixas: quem quiser os liga em dois cliques, e
 * quem não souber que existem os encontra no seletor. Um padrão generoso demais
 * transforma "Seu espaço" no que esta tela recusa desde sempre — um dashboard.
 */
export const PADRAO: PreferenciasDaHome = {
  versao: VERSAO_DAS_PREFERENCIAS,
  widgets: ["foco", "rascunho", "atividade"],
  mostrarAtencao: true,
  projetosVisiveis: 8,
  escopo: "meus",
  ordem: "parados",
};

/** Quantos projetos a lista aceita mostrar. O servidor devolve até 24. */
export const PROJETOS_VISIVEIS = [4, 6, 8, 12, 16, 24] as const;

/**
 * NORMALIZA QUALQUER COISA em preferências válidas.
 *
 * Recebe `unknown` de propósito: o que vem do `localStorage` é uma string que
 * alguém pode ter editado à mão, e o que vem de uma versão antiga do produto
 * pode ter campos que não existem mais. Nada aqui lança — a Home tem que abrir
 * mesmo com a preferência corrompida, caindo no padrão.
 */
export function normalizar(bruto: unknown): PreferenciasDaHome {
  if (!bruto || typeof bruto !== "object") return { ...PADRAO };

  const obj = bruto as Record<string, unknown>;

  /*
   * OS WIDGETS PASSAM POR TRÊS FILTROS, nesta ordem: existe no catálogo, não
   * repete, e a ordem é a de quem gravou. O `Set` é o que impede um
   * `["foco","foco"]` — gravado por um bug de arrastar — de montar o mesmo
   * componente duas vezes com a mesma `key`.
   */
  const vistos = new Set<string>();
  const widgets = Array.isArray(obj.widgets)
    ? obj.widgets.filter((id): id is string => {
        if (typeof id !== "string" || !IDS_DO_CATALOGO.includes(id)) return false;
        if (vistos.has(id)) return false;
        vistos.add(id);
        return true;
      })
    : [...PADRAO.widgets];

  const visiveis = Number(obj.projetosVisiveis);

  return {
    versao: VERSAO_DAS_PREFERENCIAS,
    /*
     * LISTA VAZIA É ESCOLHA LEGÍTIMA, e não ausência: quem desligou os três
     * widgets quer a Home sem "Seu espaço". Cair no padrão aqui os traria de
     * volta a cada F5, e a pessoa não teria como desligá-los.
     */
    widgets,
    mostrarAtencao:
      typeof obj.mostrarAtencao === "boolean" ? obj.mostrarAtencao : PADRAO.mostrarAtencao,
    projetosVisiveis: (PROJETOS_VISIVEIS as readonly number[]).includes(visiveis)
      ? visiveis
      : PADRAO.projetosVisiveis,
    escopo: obj.escopo === "todos" ? "todos" : "meus",
    ordem: typeof obj.ordem === "string" ? obj.ordem : PADRAO.ordem,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * A FRONTEIRA COM O ARMAZÉM. Duas funções, e é tudo que sabe do navegador.
 * ────────────────────────────────────────────────────────────────────────── */

export function lerPreferencias(): PreferenciasDaHome {
  /*
   * O `try` cobre mais que "não tem nada gravado": em janela anônima e com
   * cookies de terceiros bloqueados, o ACESSO ao `localStorage` já lança —
   * antes de ler qualquer chave. Sem ele a Home não monta nesses navegadores.
   */
  try {
    const cru = globalThis.localStorage?.getItem(CHAVE);
    return normalizar(cru ? JSON.parse(cru) : null);
  } catch {
    return { ...PADRAO };
  }
}

export function gravarPreferencias(prefs: PreferenciasDaHome): void {
  try {
    globalThis.localStorage?.setItem(CHAVE, JSON.stringify(normalizar(prefs)));
  } catch {
    /* Preferência que não grava é preferência que não sobrevive ao F5. É ruim,
     * e é MUITO melhor que a tela quebrar por causa de uma escolha de layout. */
  }
}

export function esquecerPreferencias(): void {
  try {
    globalThis.localStorage?.removeItem(CHAVE);
  } catch {
    /* idem */
  }
}
