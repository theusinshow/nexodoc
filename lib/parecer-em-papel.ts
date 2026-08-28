/**
 * O PARECER EM PAPEL — a estrutura, sem uma linha de PDF.
 *
 * O engenheiro entrega papel ao escritório e à prefeitura, e até aqui o único
 * caminho era imprimir a tela: cores de fundo escuro, barra lateral, botões que
 * não fazem nada no papel. O que sai daqui é uma peça do sistema, não um print.
 *
 * POR QUE ESTE ARQUIVO NÃO DESENHA NADA
 *
 * Quebrar linha, paginar e decidir o que fica junto de quê são as decisões que
 * erram — e são justamente as que o `pdf-lib` torna impossíveis de provar sem
 * abrir o arquivo gerado. Aqui elas são funções puras sobre um medidor
 * INJETADO: o desenhador passa a métrica real da fonte, o teste passa uma régua
 * de mentira (1 unidade por caractere) e mede a mesma decisão.
 *
 * A HIERARQUIA É A DA `DESIGN.md`, mapeada nas fontes que todo PDF já tem:
 * texto em Helvetica (o papel do Plex Sans), rótulo e DADO em Courier (o do
 * Plex Mono). Não é aproximação preguiçosa: é a mesma regra — o dado é mono
 * para ser conferido coluna a coluna, e o texto é proporcional para ser lido.
 */
import type { AuditFinding, AuditReport } from "./audit-report";

/** Os estilos do papel. O desenhador traduz cada um numa fonte e num corpo. */
export type EstiloDoBloco =
  /** O nome da peça, uma vez, na primeira página. */
  | "titulo"
  /** Cabeçalho de seção: SUMÁRIO, ACHADOS. Mono, caixa alta. */
  | "secao"
  /** Rótulo de campo — "OBRA", "EVIDÊNCIA". Mono, pequeno. */
  | "rotulo"
  /** Texto corrido. */
  | "texto"
  /** Dado conferível: página, código, contagem. Mono. */
  | "dado"
  /** A linha de identificação de um achado: "INC-001 · Alta · p.12". Mono. */
  | "achado"
  /** Fio horizontal. Não tem texto. */
  | "regua";

export interface Bloco {
  estilo: EstiloDoBloco;
  texto: string;
  /** Espaço extra ANTES deste bloco, em pontos. */
  respiroAntes?: number;
  /**
   * Este bloco não pode ser o último da página — ele abre um assunto.
   *
   * É o que impede o pior defeito de um parecer impresso: o cabeçalho do
   * INC-014 no pé de uma página e a evidência dele na seguinte. Quem confere
   * papel lê o achado inteiro de um golpe ou não confia nele.
   */
  abreAssunto?: boolean;
}

/** Uma página já fechada: blocos com a linha em que cada um cai. */
export interface PaginaDoParecer {
  blocos: { bloco: Bloco; linhas: string[] }[];
}

/** Medidor injetado: quantos pontos ocupa este texto neste estilo. */
export type Medidor = (texto: string, estilo: EstiloDoBloco) => number;

/** Altura de linha por estilo, em pontos. */
export const ALTURA: Record<EstiloDoBloco, number> = {
  titulo: 26,
  secao: 18,
  rotulo: 12,
  texto: 14,
  dado: 14,
  achado: 16,
  regua: 10,
};

/** Quebra um texto nas linhas que cabem na largura, pela régua injetada. */
export function quebrar(
  texto: string,
  estilo: EstiloDoBloco,
  largura: number,
  medir: Medidor,
): string[] {
  const palavras = texto.split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return [""];

  const linhas: string[] = [];
  let atual = "";

  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (medir(tentativa, estilo) <= largura || !atual) {
      atual = tentativa;
      continue;
    }
    linhas.push(atual);
    atual = palavra;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/**
 * A conta que o veredito precisa: quantos achados de cada peso.
 *
 * Sai de `impacto`, e não de `prioridade`: o impacto é o que decide se o
 * documento pode ser emitido, e é essa a pergunta que quem recebe o papel faz
 * primeiro. Achado antigo sem impacto cai em "outros" em vez de sumir — parecer
 * gravado antes do campo continua somando o mesmo total.
 */
export function contagemPorImpacto(achados: readonly AuditFinding[]) {
  let criticos = 0;
  let contratuais = 0;
  let outros = 0;
  for (const a of achados) {
    if (a.impacto === "critico_documental") criticos++;
    else if (a.impacto === "tecnico_contratual") contratuais++;
    else outros++;
  }
  return { criticos, contratuais, outros, total: achados.length };
}

/**
 * OS BLOCOS DO PARECER, em ordem — o índice do papel.
 *
 * Só achados `principal`: as sugestões da IA vivem numa seção recolhida na tela
 * porque a validação as rebaixou, e imprimir um rebaixado ao lado de um achado
 * sólido apagaria justamente a distinção que a validação existe para fazer.
 */
export function blocosDoParecer(report: AuditReport): Bloco[] {
  const achados = report.incongruencias.filter((f) => f.tier !== "sugestao");
  const conta = contagemPorImpacto(achados);
  const blocos: Bloco[] = [
    { estilo: "titulo", texto: "Parecer de auditoria" },
    { estilo: "dado", texto: `${report.tipo_documento} · ${report.obra}` },
    {
      estilo: "dado",
      texto: [report.codigo, report.municipio, report.data_documento]
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
        .join(" · "),
    },
    /*
     * SEM FIO AQUI. Havia um `regua` logo abaixo da identificação, e no papel
     * ele caía a milímetros da base da moldura chanfrada — duas linhas quase
     * paralelas dizendo a mesma coisa. Quem separa o cabeçalho é a moldura, que
     * é a assinatura do sistema; o fio era o desenho repetindo o argumento.
     */
    { estilo: "secao", texto: "Veredito", respiroAntes: 20 },
    { estilo: "texto", texto: report.status_geral },
  ];

  /*
   * A ANÁLISE INCOMPLETA VAI PARA O PAPEL, e vai LOGO ABAIXO do veredito.
   *
   * Um parecer parcial impresso sem essa linha é a pior peça que este sistema
   * poderia produzir: alguém libera um documento com base numa leitura que não
   * terminou, e o papel não deixou rastro de que não terminou.
   */
  if (report.status_analise !== "concluida") {
    blocos.push({
      estilo: "dado",
      texto:
        "ANÁLISE " +
        (report.status_analise === "parcial" ? "PARCIAL" : "COM FALHA") +
        " — não use este parecer para liberar o documento.",
    });
  }

  blocos.push(
    { estilo: "secao", texto: "Sumário", respiroAntes: 10 },
    {
      estilo: "dado",
      /*
       * O TOTAL SEMPRE; as parcelas, só as que existem.
       *
       * "0 outros" impresso num parecer gasta a atenção de quem confere para
       * dizer que não há nada — e num papel que alguém lê de pé, na obra, cada
       * palavra que não informa atrapalha. Mesma regra do recibo do drop.
       */
      texto: [
        `${conta.total} ${conta.total === 1 ? "achado" : "achados"}`,
        conta.criticos > 0
          ? `${conta.criticos} ${conta.criticos === 1 ? "crítico documental" : "críticos documentais"}`
          : "",
        conta.contratuais > 0 ? `${conta.contratuais} técnico/contratual` : "",
        conta.outros > 0
          ? `${conta.outros} ${conta.outros === 1 ? "outro" : "outros"}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
    },
  );

  if (report.conclusao?.trim()) {
    blocos.push({
      estilo: "texto",
      texto: report.conclusao.trim(),
      respiroAntes: 6,
    });
  }

  blocos.push({ estilo: "secao", texto: "Achados", respiroAntes: 14 });

  if (achados.length === 0) {
    blocos.push({ estilo: "texto", texto: "Nenhum achado a apontar." });
  }

  for (const a of achados) {
    blocos.push({
      estilo: "achado",
      // A linha de identificação é MONO porque é o que se confere contra o
      // documento: id, peso e página, sempre nesta ordem, sempre nesta coluna.
      texto: `${a.id} · ${a.prioridade} · p.${a.pagina}${a.capitulo ? ` · ${a.capitulo}` : ""}`,
      respiroAntes: 12,
      abreAssunto: true,
    });
    blocos.push({ estilo: "texto", texto: a.tipo, abreAssunto: true });
    if (a.descricao?.trim())
      blocos.push({ estilo: "texto", texto: a.descricao.trim() });
    if (a.evidencia?.trim()) {
      blocos.push({
        estilo: "rotulo",
        texto: "EVIDÊNCIA",
        respiroAntes: 4,
        // Rótulo sozinho no pé da página não diz nada: ele existe por
        // causa da linha de baixo, e os dois descem juntos.
        abreAssunto: true,
      });
      blocos.push({ estilo: "texto", texto: `"${a.evidencia.trim()}"` });
    }
    if (a.conflito?.trim()) {
      blocos.push({
        estilo: "rotulo",
        texto: "CONFLITO",
        respiroAntes: 4,
        // Rótulo sozinho no pé da página não diz nada: ele existe por
        // causa da linha de baixo, e os dois descem juntos.
        abreAssunto: true,
      });
      blocos.push({ estilo: "texto", texto: a.conflito.trim() });
    }
    if (a.sugestao_correcao?.trim()) {
      blocos.push({
        estilo: "rotulo",
        texto: "CORREÇÃO RECOMENDADA",
        respiroAntes: 4,
        // Rótulo sozinho no pé da página não diz nada: ele existe por
        // causa da linha de baixo, e os dois descem juntos.
        abreAssunto: true,
      });
      blocos.push({ estilo: "texto", texto: a.sugestao_correcao.trim() });
    }
  }

  return blocos;
}

export interface MedidasDaPagina {
  /** Largura útil do texto, em pontos. */
  largura: number;
  /** Altura útil, já descontados cabeçalho e rodapé. */
  altura: number;
}

/**
 * A PAGINAÇÃO — e a única regra dela que importa.
 *
 * Um bloco que `abreAssunto` não fica sozinho no pé: se ele e o SEGUINTE não
 * couberem juntos, os dois descem. É o que impede o cabeçalho do INC-014 no fim
 * de uma página e a evidência dele na outra — quem confere papel lê o achado
 * inteiro de um golpe, ou não confia nele.
 *
 * Bloco que não cabe numa página inteira não vira página em branco: ele é
 * cortado pela quebra de linha e ocupa o que precisar. Um parágrafo de evidência
 * de 40 linhas é raro e continua legível partido; página vazia não.
 */
export function paginarParecer(
  blocos: readonly Bloco[],
  medidas: MedidasDaPagina,
  medir: Medidor,
): PaginaDoParecer[] {
  const preparados = blocos.map((bloco) => {
    const linhas =
      bloco.estilo === "regua"
        ? [""]
        : quebrar(bloco.texto, bloco.estilo, medidas.largura, medir);
    const alto =
      (bloco.respiroAntes ?? 0) + linhas.length * ALTURA[bloco.estilo];
    return { bloco, linhas, alto };
  });

  const paginas: PaginaDoParecer[] = [];
  let atual: PaginaDoParecer = { blocos: [] };
  let usado = 0;

  const fechar = () => {
    if (atual.blocos.length > 0) paginas.push(atual);
    atual = { blocos: [] };
    usado = 0;
  };

  for (let i = 0; i < preparados.length; i++) {
    const p = preparados[i];
    // O par que não pode ser separado: este bloco e o próximo, quando este abre
    // assunto. Sem o par, a régua mediria só o cabeçalho e ele caberia sozinho.
    const par = p.bloco.abreAssunto
      ? p.alto + (preparados[i + 1]?.alto ?? 0)
      : p.alto;

    if (usado > 0 && usado + par > medidas.altura) fechar();

    atual.blocos.push({ bloco: p.bloco, linhas: p.linhas });
    usado += p.alto;
  }

  fechar();
  return paginas.length > 0 ? paginas : [{ blocos: [] }];
}

/**
 * O RODAPÉ, que é o selo do produto no papel.
 *
 * Vai em toda página porque folha solta de parecer circula sozinha dentro do
 * escritório — a que chega à mesa do fiscal pode ser a página 4, e ela precisa
 * dizer de que obra é e de que parecer veio.
 */
export function rodapeDaPagina(
  report: AuditReport,
  pagina: number,
  total: number,
): string {
  const obra = (report.obra ?? "").trim() || "sem obra declarada";
  const codigo = (report.codigo ?? "").trim();
  return `NEXODOC · ${codigo ? `${codigo} · ` : ""}${obra} · ${pagina}/${total}`;
}
