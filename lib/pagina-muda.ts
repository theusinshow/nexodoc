/**
 * A PÁGINA MUDA: tem conteúdo na folha e não entrega caractere nenhum.
 *
 * O caso que originou este módulo (02/09/2026) é o memorial da Passarela do
 * Canal da Barra, `114_19_VOLUME ÚNICO.pdf`. Ele passou pela auditoria e quase
 * nada foi encontrado. A medição:
 *
 *   31 páginas, 7.470 caracteres extraídos — 241 por página.
 *   16 páginas (52%) com ZERO caractere. 25 de 31 (81%) com menos de 200.
 *
 * Um memorial dessas 31 páginas entrega ~60 mil caracteres. Chegaram ~10%, e a
 * auditoria opinou sobre o documento com um décimo dele na mão.
 *
 * E NÃO É PÁGINA ESCANEADA — foi a suposição errada que atrasou o diagnóstico.
 * Rasterizadas, as páginas mudas são texto nítido, perfeitamente legível. O
 * texto está DESENHADO, não escrito:
 *
 *   p5, p7   `constructPath=74`, ZERO `beginText` — o texto virou curva vetorial
 *   p9       `paintImageXObject=24` — cada linha virou tira de imagem (944x92)
 *
 * Não é limitação do pdf.js: o `pdftotext` (poppler) nas páginas 7-9 devolve
 * três caracteres de quebra de página. O texto NÃO EXISTE COMO TEXTO no arquivo,
 * e nenhum ajuste em [[pdf-text.ts]] o recupera. Só relendo a folha com o olho —
 * que aqui é a visão do modelo.
 *
 * PURO de propósito: sem IA, sem rede, sem I/O. Ele só CLASSIFICA. Quem paga a
 * transcrição é [[transcricao-por-visao.ts]], e quem decide se paga é o
 * engenheiro, no portão da entrada.
 */
/*
 * CICLO DE IMPORT, DELIBERADO E FRÁGIL — leia antes de mexer.
 *
 * Este módulo importa `montarDocumento` de [[pdf-text.ts]], e [[pdf-text.ts]]
 * importa `LIMIAR_DE_CARACTERES` daqui. O ciclo resolve porque os dois lados só
 * tocam o que importaram DENTRO de funções, avaliadas depois de os dois módulos
 * terem carregado — provado nas duas ordens de import.
 *
 * O que o quebra: usar qualquer um desses símbolos no TOPO do módulo (uma
 * constante derivada, um `Set` pré-montado, um valor padrão de parâmetro
 * avaliado na carga). Aí um dos lados lê `undefined` conforme quem entrar
 * primeiro — e falha só em um dos pontos de entrada, que é a pior forma de
 * falhar. Se precisar disso, quebre o ciclo antes.
 */
import { montarDocumento, type ExtractedPdf, type ExtractedPdfPage } from "./pdf-text.ts";

/**
 * O limiar de caracteres abaixo do qual a página é suspeita.
 *
 * MEDIDO no 114-19, e não chutado. As 6 páginas de texto real da capa ao anexo
 * entregam 359, 383, 756, 1.030, 1.216 e 3.350 caracteres. As 25 mudas entregam
 * 0, 24, 33 e 59 — os 24 são a legenda "Passarela Canal da Barra" sob uma
 * prancha de cálculo cujos rótulos inteiros estão em vetor.
 *
 * O vão entre 59 e 359 é largo, e 120 fica no meio dele. Um limiar mais alto
 * começaria a mandar folha de rosto legítima para a transcrição; mais baixo
 * deixaria a prancha de cálculo passar por lida.
 */
export const LIMIAR_DE_CARACTERES = 120;

/**
 * A VERSÃO DO TRANSCRITOR — a mesma ideia de `VERSAO_DO_LEITOR` do selo.
 *
 * SUBA ESTE NÚMERO ao mexer em qualquer coisa que mude o que sai da transcrição:
 * o prompt, o modelo padrão, a escala com que o cliente rasteriza a folha. A
 * chave do cache a carrega, então subir invalida tudo sozinho. Esquecer faz o
 * cache servir, calado, a transcrição de um transcritor que já se sabe errado —
 * e o sintoma aparece semanas depois, num projeto antigo que "voltou a errar o
 * que já tinha sido corrigido".
 *
 * MORA NESTE MÓDULO, e não em [[transcricao-por-visao.ts]] com o resto do
 * transcritor, porque quem a consome é o cache — que é do navegador. Lá ela
 * arrastava o `ai-runner` e o Prisma para o bundle do browser, e o build
 * quebrava tentando resolver `pg`, `dns` e `net`. Este módulo é puro: é o que
 * os dois lados podem compartilhar.
 */
export const VERSAO_DO_TRANSCRITOR = 1;

/**
 * A TINTA NA FOLHA: quanto a página manda desenhar, fora o texto.
 *
 * É o sinal que separa "muda" de "vazia", e sem ele o detector é um contador de
 * caracteres que pagaria transcrição por toda folha de separação em branco de
 * todo volume. Sai da mesma passada de extração — ver `extractPdfText`.
 */
export interface TintaDaPagina {
  /** Ops de caminho vetorial (`constructPath`). Texto virado curva mora aqui. */
  desenho: number;
  /** Ops de imagem (`paintImage*`). Linha de texto virada tira mora aqui. */
  imagem: number;
}

export type ClasseDaPagina =
  /** Entregou texto. É o caso normal, e a auditoria já a lê. */
  | "texto"
  /** Tem tinta na folha e não entregou texto. Vale pagar para reler. */
  | "muda"
  /** Nem texto nem tinta. Separador, verso em branco — não vale nada. */
  | "vazia";

export interface PaginaClassificada {
  pagina: number;
  classe: ClasseDaPagina;
  caracteres: number;
}

/**
 * Quanta tinta basta para a folha valer uma transcrição.
 *
 * 1 é de propósito. A alternativa seria calibrar um piso, e não há número
 * honesto para calibrar: a página 20 do 114-19 tem UMA imagem (o logo da
 * PROSUL) e um caminho, e mesmo assim carrega texto vetorial no corpo. Errar
 * para o lado de transcrever custa centavos; errar para o outro devolve ao
 * engenheiro o mesmo parecer cego que originou este módulo.
 */
const TINTA_MINIMA = 1;

/** A página tem alguma coisa desenhada nela? */
function temTinta(tinta: TintaDaPagina | undefined): boolean {
  if (!tinta) {
    /*
     * SEM MEDIÇÃO NÃO SE AFIRMA VAZIO. Fixture montada à mão e parecer antigo
     * não trazem `tinta`, e chamá-los de "vazia" faria o detector declarar
     * silenciosamente que não há nada a recuperar — a mesma classe de silêncio
     * que este módulo existe para acabar. Sem o sinal, a folha é suspeita.
     */
    return true;
  }
  return tinta.desenho + tinta.imagem >= TINTA_MINIMA;
}

export function classificarPagina(page: ExtractedPdfPage): PaginaClassificada {
  const caracteres = page.text.trim().length;

  /*
   * A FOLHA JÁ RELIDA NÃO VOLTA À FILA, por curta que seja a transcrição.
   *
   * O limiar mede a EXTRAÇÃO — ele decide se vale pagar para reler. Uma folha
   * com `origem: "visao"` já foi relida: se voltou com 27 caracteres, é porque
   * é o que está escrito nela (a prancha de cálculo do 114-19 tem só a legenda),
   * e mandá-la de novo pagaria a mesma chamada para receber a mesma resposta.
   *
   * Sem esta saída o dano ia além do desperdício. `contarPaginasDoDocumento`
   * soma as mudas com as transcritas, então uma folha que continuasse muda
   * depois de transcrita seria contada duas vezes: 25 mudas + 25 transcritas =
   * 50, menos 25 recuperadas = 25 pendentes. O parecer declararia o documento
   * inteiro por ler DEPOIS de a transcrição ter sido paga — e a auditoria teria
   * lido tudo. Apanhado por `scripts/prova-pagina-muda.ts` contra o arquivo real.
   */
  if (page.origem === "visao") {
    return { pagina: page.page, classe: "texto", caracteres };
  }

  if (caracteres >= LIMIAR_DE_CARACTERES) {
    return { pagina: page.page, classe: "texto", caracteres };
  }

  return {
    pagina: page.page,
    classe: temTinta(page.tinta) ? "muda" : "vazia",
    caracteres,
  };
}

export interface DiagnosticoDoDocumento {
  paginas: PaginaClassificada[];
  /** As páginas que valem transcrição, em ordem. É o que o portão mostra. */
  mudas: number[];
  totalDePaginas: number;
}

export function diagnosticarPaginasMudas(extracted: ExtractedPdf): DiagnosticoDoDocumento {
  const paginas = extracted.pages.map(classificarPagina);

  return {
    paginas,
    mudas: paginas.filter((p) => p.classe === "muda").map((p) => p.pagina),
    totalDePaginas: extracted.pageCount,
  };
}

/** O que o cliente devolve depois de reler uma folha muda com o modelo. */
export interface PaginaTranscrita {
  pagina: number;
  texto: string;
}

/**
 * FUNDE a transcrição no documento extraído.
 *
 * A folha transcrita passa a ter texto como qualquer outra — os ~30 consumidores
 * de `ExtractedPdf` não sabem a diferença e não precisam saber — mas fica
 * MARCADA com `origem: "visao"`. A marca é o que impede o visor de tentar
 * grifar um trecho cuja coordenada não existe, e o que deixa a cobertura contar
 * a folha como recuperada em vez de lida.
 *
 * PURA, e é o que a torna testável sem rede: recebe o documento e os textos,
 * devolve o documento novo. Quem paga o modelo é a rota.
 *
 * SÓ ESCREVE ONDE ESTAVA MUDO. Uma transcrição que chegue apontando para uma
 * página com texto próprio é IGNORADA — a entrada vem do cliente, e sobrescrever
 * a extração com o que o cliente mandou seria deixar a evidência de todo achado
 * daquela folha ser ditada de fora. Transcrição vazia também não entra: ela
 * apagaria a página sem que ninguém pedisse.
 */
export function aplicarTranscricao(
  extracted: ExtractedPdf,
  transcricoes: readonly PaginaTranscrita[],
): ExtractedPdf {
  if (transcricoes.length === 0) return extracted;

  const mudas = new Set(diagnosticarPaginasMudas(extracted).mudas);
  const porPagina = new Map<number, string>();
  for (const t of transcricoes) {
    const texto = t.texto.trim();
    if (texto && mudas.has(t.pagina)) porPagina.set(t.pagina, texto);
  }

  if (porPagina.size === 0) return extracted;

  const pages = extracted.pages.map((page): ExtractedPdfPage => {
    const texto = porPagina.get(page.page);
    if (!texto) return page;
    return { ...page, text: texto, origem: "visao" };
  });

  return montarDocumento(pages, extracted.pageCount);
}

/**
 * A FRASE DO PORTÃO. Existe aqui, e não na tela, porque é a mesma frase que o
 * parecer precisa quando a transcrição é RECUSADA — e duas redações do mesmo
 * fato divergem no dia em que uma delas for corrigida.
 *
 * Devolve "" quando não há página muda: o portão que fala sempre é ruído, como
 * o "ATENÇÃO" que tocava em toda auditoria antes de 18/08 (ver
 * [[resumo-do-esforco.ts]]).
 */
export function fraseDoDiagnostico(d: DiagnosticoDoDocumento): string {
  if (d.mudas.length === 0) return "";

  return (
    `${d.mudas.length} de ${d.totalDePaginas} páginas deste documento não têm texto: ` +
    "o conteúdo está desenhado na folha, não escrito. Sem transcrever, a auditoria não as lê."
  );
}
