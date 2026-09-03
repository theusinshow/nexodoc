/**
 * MEMORIAL OU PRANCHA — o julgamento, antes de ler o arquivo.
 *
 * O roteamento sempre foi pelo NOME: `isMemorialFile` é
 * `parseFilename(nome).tipo === "memorial"`, e a partição é binária — memorial
 * contra todo o resto. Arquivo que caia em `tipo: "outro"` vai para o fluxo de
 * prancha exatamente como uma prancha vai, e ninguém olha o conteúdo antes.
 *
 * Medido em 03/09/2026 sobre os 661 PDFs do acervo: a convenção acerta quase
 * todos. O nome só erra quando quem nomeou está FORA da convenção do escritório
 * — o arquivo que chega do cliente ou de outro escritório. Por isso a convenção
 * continua mandando onde ela fala, e a geometria entra como contestação, nunca
 * como substituta.
 *
 * O RESULTADO da regra inteira sobre esse acervo (`npm run medir:papel`):
 *
 *   636 prancha · 18 memorial · 7 pergunta   —  ZERO troca de lado
 *
 * Das 7 perguntas, 6 são os memoriais do kit de erros plantados, cujo nome diz
 * "capa" ou virou número de folha; a sétima é um `Relatório de Sondagem` de 14
 * folhas, que é ambíguo de verdade. 1,1% de perguntas é o preço, e ele cai todo
 * em cima de arquivo que hoje é roteado errado em silêncio.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *
 * REUSA `classificarPagina`, e não reimplementa a geometria.
 *
 * "Papel grande", "tem carimbo" e "é índice" já estão decididos em
 * `server/nexo/selo-regiao.ts`, que é o mesmo julgamento que a leitura de selo
 * usa para pular folha. Escrever aqui um segundo `maiorLado > N` daria duas
 * noções de "isto é prancha" no mesmo repositório — e a discordância entre elas
 * apareceria como um arquivo que o chip chama de memorial e o leitor de selo
 * insiste em ler.
 *
 * O que sobra para este módulo é o que aquele não responde: quantas folhas o
 * documento tem, quanto texto cada uma carrega, e se a folha sem texto tem
 * tinta (folha muda) ou está vazia de verdade.
 *
 * PURO e sem I/O — roda no `node` cru, que é onde os limiares ficam prováveis
 * sem navegador. Quem colhe os fatos é [[pre-voo-do-anexo.ts]].
 */
import type { NexoDocTipo } from "../../../server/nexo/parse-filename.ts";
import type { TipoDePagina } from "../../../server/nexo/selo-regiao.ts";

/** O que se mediu de UMA folha da amostra. */
export interface MedidaDaPagina {
  /** O veredito de `classificarPagina` — prancha / indice / capa / outra. */
  tipo: TipoDePagina;
  /** Caracteres extraíveis da folha. */
  chars: number;
  /** A folha manda desenhar (curva ou imagem) apesar de não ter texto. */
  temTinta: boolean;
}

export interface FatosDoAnexo {
  paginas: number;
  amostra: MedidaDaPagina[];
}

export type PapelPelaGeometria = "memorial" | "prancha" | "nao-sei";
export type PapelDoAnexo = "memorial" | "prancha" | "indeciso";

/**
 * A partir de quantas folhas um PDF deixa de ser capa/separatriz e vira
 * documento. Capa e separatriz do acervo têm 1 folha; o menor memorial tem 11.
 */
export const PAGINAS_PARA_SER_DOCUMENTO = 10;

/**
 * Caracteres por folha a partir dos quais o documento é texto corrido.
 *
 * MEDIDO nos 661 PDFs do acervo com a amostra espalhada (`npm run medir:papel`,
 * 03/09/2026), contando só documentos de 10+ folhas sem carimbo:
 *
 *   menor MEMORIAL ......... 846 chars/folha  (116_25_md_geral_b, 258 págs)
 *   maior NÃO-memorial ..... 353 chars/folha  (040-26_vol3_..., volume, 42 págs)
 *
 * 600 é o meio desse vão. Não é o número que eu tinha escrito no spec: lá
 * estava 1000, calculado sobre as TRÊS PRIMEIRAS folhas de cada arquivo, em que
 * o menor memorial dava 1157. Com a amostra espalhada o mesmo acervo devolve
 * 846 — e a premissa que eu tinha usado para justificar espalhar a amostra
 * ("o começo do memorial é a parte magra") estava invertida neste arquivo: o
 * miolo do 116_25 é mais ralo que a abertura. A amostra espalhada continua
 * certa, e por um motivo melhor do que o meu: ela é a MAIS CONSERVADORA das
 * duas, porque encontra a região rala em vez de contorná-la.
 *
 * Em 1000, quatro memoriais reais do acervo caíam em "não sei". Eles seriam
 * roteados certo de qualquer forma (o nome deles segue a convenção), então o
 * defeito não apareceria em teste nenhum — apareceria no dia em que um desses
 * quatro chegasse com nome de cliente.
 */
export const CHARS_DE_MEMORIAL = 600;

/**
 * Abaixo disto a folha não tem texto para efeito de julgamento.
 *
 * O `114_19` tem 241 chars/folha porque o texto virou curva vetorial. Não é
 * folha em branco, e não é folha lida: é o caso que a densidade não alcança, e
 * o único desfecho honesto é perguntar.
 */
export const CHARS_DE_FOLHA_MUDA = 400;

const media = (n: readonly number[]) =>
  n.length === 0 ? 0 : n.reduce((s, v) => s + v, 0) / n.length;

/**
 * QUAIS FOLHAS MEDIR — primeira, meio e três quartos.
 *
 * As três PRIMEIRAS seriam o palpite óbvio e são o pior corte possível: um
 * memorial abre com capa, folha de assinaturas e sumário, que juntas carregam
 * menos texto que qualquer capítulo. O `116_25_md_ter_pav` já está a 1157
 * chars/folha na média geral; medido só no começo, ele cairia abaixo do limiar
 * e o documento inteiro seria roteado errado.
 *
 * Três folhas, e não cinco: cada uma custa um `getTextContent`, e o vão entre
 * volume (570) e memorial (1157) é largo o bastante para não precisar de mais
 * amostra. Documento curto devolve só as folhas que existem, sem repetir.
 */
export function paginasDaAmostra(total: number): number[] {
  if (total <= 0) return [];
  const candidatas = [1, Math.ceil(total / 2), Math.ceil((total * 3) / 4)];
  const vistas = new Set<number>();
  const saida: number[] = [];
  for (const n of candidatas) {
    const dentro = Math.min(Math.max(1, n), total);
    if (!vistas.has(dentro)) {
      vistas.add(dentro);
      saida.push(dentro);
    }
  }
  return saida;
}

/**
 * O que o CONTEÚDO diz, ignorando o nome do arquivo.
 *
 * A ordem das perguntas é a garantia, e é a mesma de `classificarPagina`: o
 * carimbo decide primeiro. Uma folha com carimbo prova o arquivo inteiro —
 * memorial nenhum tem selo de prancha —, e por isso ela vem antes da contagem
 * de texto, que é estatística.
 */
export function papelPelaGeometria(fatos: FatosDoAnexo): PapelPelaGeometria {
  if (fatos.amostra.length === 0) return "nao-sei";

  // Uma só basta: `classificarPagina` só diz "prancha" com âncoras de carimbo
  // ou papel grande, e nenhum dos dois acontece por acaso num memorial.
  if (fatos.amostra.some((p) => p.tipo === "prancha")) return "prancha";

  const chars = media(fatos.amostra.map((p) => p.chars));

  if (fatos.paginas >= PAGINAS_PARA_SER_DOCUMENTO) {
    if (chars >= CHARS_DE_MEMORIAL) return "memorial";
    /*
     * Folhas demais, texto de menos e tinta na folha: o texto está DESENHADO.
     * Ver [[lib/pagina-muda.ts]]. Aqui não se decide — pergunta-se, e é o mesmo
     * desfecho do documento grande que não se parece com nada conhecido. Os
     * dois estão escritos separados de propósito: o de cima é o caso que se
     * conhece (folha muda) e o de baixo é o que não se conhece, e um dia eles
     * vão querer frases diferentes.
     */
    if (chars < CHARS_DE_FOLHA_MUDA && fatos.amostra.some((p) => p.temTinta)) {
      return "nao-sei";
    }
    return "nao-sei";
  }

  /*
   * Documento de uma ou duas folhas é capa, separatriz ou LD — o fluxo de
   * prancha lida com os três há muito tempo, e pular esses arquivos é o
   * comportamento certo dele. Perguntar aqui poria uma pergunta em toda
   * montagem de volume.
   *
   * SEM olhar a densidade, e isto foi medido: a condição era
   * `paginas <= 2 && chars < CHARS_DE_MEMORIAL`, e baixar aquele limiar de 1000
   * para 600 empurrou 21 capas do acervo para "não sei" — capas com 600 a 1000
   * caracteres, que são capas exatamente como as outras. O número de folhas e a
   * densidade respondem perguntas diferentes, e amarrá-los fazia um limiar
   * mexer no que o outro decide. Memorial de duas folhas não existe: o menor do
   * acervo tem 11.
   */
  if (fatos.paginas <= 2) return "prancha";

  return "nao-sei";
}

/**
 * Os tipos de nome que afirmam "isto não é memorial" E que a geometria pode
 * contestar.
 *
 * `orcamento` FICA FORA, e não por esquecimento: planilha orçamentária é A4
 * retrato cheia de texto, então a geometria a chama de memorial toda vez. Mas
 * ela está fora do escopo do Nexo (`parseFilename` devolve `foraDeEscopo`), e
 * perguntar "memorial ou prancha?" sobre um orçamento oferece duas respostas
 * erradas. Ele segue como não-memorial, calado, como sempre seguiu.
 */
const NOME_DIZ_PRANCHA: readonly NexoDocTipo[] = [
  "prancha",
  "capa",
  "separatriz",
  "volume",
];

/**
 * O PAPEL FINAL, cruzando a convenção com o conteúdo.
 *
 * A regra em uma frase: **o nome é o palpite, a geometria pode contestar, e
 * contestação vira pergunta**. Nunca se troca um nome confiante em silêncio —
 * a convenção acerta 656 de 659, e sobrepô-la calado trocaria um erro raro e
 * visível por um erro raro e invisível.
 */
export function decidirPapel(args: {
  pelaConvencao: NexoDocTipo;
  pelaGeometria: PapelPelaGeometria;
  fatos: FatosDoAnexo;
}): { papel: PapelDoAnexo; porque: string } {
  const { pelaConvencao, pelaGeometria, fatos } = args;

  if (pelaConvencao === "memorial") {
    return { papel: "memorial", porque: "O nome segue a convenção de memorial." };
  }

  if (pelaConvencao === "orcamento") {
    // Fora do escopo do Nexo, e a geometria não tem como saber disso: ela vê
    // A4 retrato cheio de texto e diz "memorial". Ver `NOME_DIZ_PRANCHA`.
    return { papel: "prancha", porque: "O nome diz orçamento, que está fora do escopo." };
  }

  if (NOME_DIZ_PRANCHA.includes(pelaConvencao)) {
    if (pelaGeometria === "memorial") {
      return {
        papel: "indeciso",
        porque:
          `O nome diz ${pelaConvencao}, mas são ${fatos.paginas} folhas de texto corrido — ` +
          "isso é o formato de um memorial.",
      };
    }
    return { papel: "prancha", porque: "O nome segue a convenção do escritório." };
  }

  // `outro`: o nome não afirma nada, e aí quem fala é o conteúdo.
  if (pelaGeometria === "memorial") {
    return {
      papel: "memorial",
      porque: `O nome não diz o tipo; são ${fatos.paginas} folhas de texto corrido.`,
    };
  }
  if (pelaGeometria === "prancha") {
    return {
      papel: "prancha",
      porque: "O nome não diz o tipo; a folha tem carimbo de prancha.",
    };
  }
  return {
    papel: "indeciso",
    porque:
      `O nome não diz o tipo, e as ${fatos.paginas} folhas não se parecem nem com ` +
      "memorial nem com prancha.",
  };
}
