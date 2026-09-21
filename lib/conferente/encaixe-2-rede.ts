/**
 * ENCAIXE 2 — a rede de arrasto onde o modelo grande não leu.
 *
 * É O ENCAIXE DE MAIOR VALOR, e o motivo é aritmético.
 *
 * O motor JÁ SABE, com precisão, onde não olhou: `CoberturaDoArquivo` grava
 * `blocos_lidos / blocos_totais`, e `resumo-do-esforco.ts` só existe porque um
 * parecer chegou a afirmar 98 blocos tendo lido 8. Medido: 24% dos blocos
 * ficaram censurados no teto entre jun e ago/2026, e houve auditoria em que 71%
 * do gasto foi para 20 blocos que truncaram e devolveram ZERO.
 *
 * Hoje o sistema consegue DECLARAR o buraco e nada mais. Tapá-lo custa outra
 * passada do `sol`: US$ 0,76 de entrada por bloco, mais a saída, mais 81 s.
 *
 * E FOI A SAÍDA QUE CRIOU O BURACO. O teto que censurou os blocos é de saída —
 * o modelo grande precisa ESCREVER o achado, e escrever é o que custa. No
 * conferente a saída é de graça: varrer um bloco custa a entrada dele e mais
 * nada. 25 blocos × 7.600 tokens = US$ 0,008.
 *
 * O QUE ESTA VARREDURA É, E O QUE ELA NÃO É
 *
 * Ela não descobre defeito novo: pergunta por uma LISTA FECHADA de defeitos
 * que já sabemos que este escritório comete — as regras de `audit-coherence.ts`
 * viradas pergunta. É rede de arrasto, não leitura.
 *
 * O achado que sai daqui nasce marcado `rede`, com confiança baixa e sem o
 * trecho exato. Isso é menos do que o `sol` entrega, e é dito como tal. Mas é
 * infinitamente mais do que o que existe hoje para esses blocos, que é nada.
 *
 * "análise parcial" deixa de significar "ninguém olhou".
 */

import type { AuditFinding } from "@/lib/audit-report";
import type { AuditTextChunk } from "@/lib/pdf-text";

import { perguntarAoConferente, type Pergunta, type RespostaNoul } from "./jev";

/**
 * A LISTA FECHADA — os defeitos recorrentes deste acervo, virados pergunta.
 *
 * Cada um tem uma regra determinística em `audit-coherence.ts` ou nasceu de um
 * achado que eu conferi num memorial real. Não é uma lista de "coisas ruins em
 * geral": é o que ESTE escritório erra, medido nos 10 memoriais do acervo.
 *
 * Manter a lista curta é deliberado. Trinta perguntas num bloco de 7.600 tokens
 * é uma requisição; trezentas seriam uma leitura disfarçada de conjunto fechado,
 * e leitura é trabalho do modelo grande.
 */
type DefeitoDaRede = {
  chave: string;
  pergunta: Pergunta;
  /** O que vira o achado quando a rede acusa. */
  tipo: string;
  conflito: string;
  sugestao: string;
};

const DEFEITOS: DefeitoDaRede[] = [
  {
    chave: "wrong_unit",
    tipo: "Unidade possivelmente incorreta (rede de arrasto)",
    conflito:
      "A varredura apontou uma grandeza cuja unidade não fecha com o que ela descreve — conferir no trecho.",
    sugestao: "Localizar a grandeza citada e conferir a unidade contra o uso corrente do elemento.",
    pergunta: {
      type: "noul",
      instructions:
        "Does this text contain a quantity whose unit is wrong by an order of magnitude for what it describes?",
      criteria: {
        true: 'A thickness in metres that should be millimetres, a steel section in metres, a resistance given as "300 kg/m²", a coating in "0,254 microns", a board 0,20 cm wide.',
        false: "Every quantity carries a unit that is plausible for the element it describes.",
      },
    },
  },
  {
    chave: "other_project_residue",
    tipo: "Resíduo de outro projeto (rede de arrasto)",
    conflito:
      "A varredura encontrou menção a um tipo de obra ou órgão que não é o deste projeto — indício de texto reaproveitado.",
    sugestao: "Localizar a menção e substituí-la pelo elemento efetivo desta obra.",
    pergunta: {
      type: "noul",
      instructions:
        "Does this text mention a building type, institution or public body that does not belong to the project it is part of?",
      criteria: {
        true: 'Leftover text naming another kind of work or body: "escadas da escola", "Secretaria Municipal de Educação", "o hospital", "as salas de aula", when the project is something else.',
        false: "Every mention fits one single kind of work.",
      },
    },
  },
  {
    chave: "road_language",
    tipo: "Linguagem de projeto rodoviário (rede de arrasto)",
    conflito: "A varredura encontrou vocabulário de projeto viário fora de um projeto viário.",
    sugestao: "Adaptar a linguagem ao escopo real da implantação.",
    pergunta: {
      type: "noul",
      instructions: "Does this text use highway-design vocabulary?",
      criteria: {
        true: '"eixo da rodovia", "corpo estradal", "superelevação das pistas", "hierarquização das vias", "rodovias existentes", kilometre stationing.',
        false: "No highway-specific vocabulary appears.",
      },
    },
  },
  {
    chave: "contradiction",
    tipo: "Contradição interna (rede de arrasto)",
    conflito: "A varredura apontou duas exigências incompatíveis dentro do mesmo trecho.",
    sugestao: "Localizar as duas exigências e manter uma só.",
    pergunta: {
      type: "noul",
      instructions: "Does this text state two requirements that contradict each other?",
      criteria: {
        true: "Two different values for the same dimension, two different materials for the same element, two different deadlines for the same operation, or two rules that cannot both be followed.",
        false: "Requirements are consistent, or differ because they apply to different elements.",
      },
    },
  },
  {
    chave: "unlisted_reference",
    tipo: "Remissão a peça não declarada (rede de arrasto)",
    conflito: "A varredura encontrou remissão a uma peça ou item que o documento não declara.",
    sugestao: "Conferir se a peça citada integra a relação de documentos do projeto.",
    pergunta: {
      type: "noul",
      instructions:
        "Does this text point the reader to another volume, annex, drawing or numbered item as the source of a requirement or a quantity?",
      criteria: {
        true: 'A requirement whose content lives elsewhere: "apresentadas no Volume 2", "conforme Anexo III", "ver prancha 04", "conforme item 3.4.2".',
        false: "The text is self-contained; any standard it cites is external and named as such.",
      },
    },
  },
  {
    chave: "arithmetic_mismatch",
    tipo: "Conta que não fecha (rede de arrasto)",
    conflito: "A varredura apontou um total que não confere com as parcelas listadas.",
    sugestao: "Refazer a soma das parcelas e corrigir o total ou a distribuição.",
    pergunta: {
      type: "noul",
      instructions: "Does this text present a total that does not match the parts listed with it?",
      criteria: {
        true: "A sum, an area total, a population or a load total that differs from the items enumerated next to it.",
        false: "Either there is no total, or every total matches its parts.",
      },
    },
  },
  {
    chave: "template_placeholder",
    tipo: "Campo de modelo não preenchido (rede de arrasto)",
    conflito: "A varredura encontrou marcador de modelo que ficou no texto.",
    sugestao: "Preencher o campo antes de emitir.",
    pergunta: {
      type: "noul",
      instructions: "Does this text contain an unfilled template placeholder?",
      criteria: {
        true: 'Markers such as "XXXX", "____", "[inserir]", "NOME DA OBRA", "xx/xx/xxxx" left where a value belongs.',
        false: "Every field carries a real value.",
      },
    },
  },
  {
    chave: "superseded_standard",
    tipo: "Norma possivelmente desatualizada (rede de arrasto)",
    conflito: "A varredura encontrou norma citada com edição antiga ou nomenclatura pré-ABNT.",
    sugestao: "Conferir a edição vigente no catálogo ABNT.",
    pergunta: {
      type: "noul",
      instructions: "Does this text cite a technical standard by an old edition or a pre-1990 designation?",
      criteria: {
        true: 'Editions from the 1970s/80s, or designations such as "EB-829/75", "NB-19/83", "NB-597/77", or a malformed year.',
        false: "Standards are cited with recent editions or without a year.",
      },
    },
  },
];

function ehNoul(valor: unknown): valor is RespostaNoul {
  return Boolean(valor) && (valor as RespostaNoul).type === "noul";
}

/**
 * O CORTE É ALTO (0,75) porque a rede fala sobre o que ninguém leu.
 *
 * Um achado de rede não tem trecho exato para o engenheiro conferir em dois
 * segundos: ele tem o bloco e o tipo. Achado assim custa caro de investigar, e
 * uma rede tagarela faria o engenheiro parar de abrir os blocos varridos — que
 * é o oposto do objetivo.
 */
const CORTE = 0.75;

/**
 * Varre UM bloco que ninguém leu. Devolve os achados de rede.
 *
 * Todo achado sai com `confianca: "baixa"` e `origem: "ia"`. Baixa porque ele é
 * mesmo menos certo; `ia` e não `regra` porque não é determinístico e não pode
 * herdar a blindagem do achado de regra.
 */
export async function varrerBloco(
  bloco: AuditTextChunk,
  arquivo: string,
  contexto?: { userEmail?: string | null; conversationId?: string | null },
): Promise<AuditFinding[]> {
  const perguntas: Record<string, Pergunta> = {};

  for (const defeito of DEFEITOS) {
    perguntas[defeito.chave] = defeito.pergunta;
  }

  const resposta = await perguntarAoConferente({
    estado: bloco.text,
    perguntas,
    operacao: "conferente-rede",
    userEmail: contexto?.userEmail,
    conversationId: contexto?.conversationId,
  });

  if (!resposta) {
    return [];
  }

  const achados: AuditFinding[] = [];

  for (const defeito of DEFEITOS) {
    const bruta = resposta.respostas[defeito.chave];

    if (!ehNoul(bruta) || bruta.noul < CORTE) {
      continue;
    }

    achados.push({
      id: `REDE-${bloco.id}-${defeito.chave}`,
      arquivo,
      origem: "ia",
      confianca: "baixa",
      prioridade: "Media",
      /*
       * SEM `impacto` DECLARADO, de propósito. A rede sabe QUE tem algo, não o
       * quanto pesa — e a faixa sai da heurística de escopo ou do Encaixe 3,
       * que são quem tem como decidir isso. Declarar faixa aqui seria a rede
       * opinando sobre gravidade a partir de um sim/não.
       */
      pagina:
        bloco.startPage === bloco.endPage
          ? String(bloco.startPage)
          : `${bloco.startPage}-${bloco.endPage}`,
      capitulo: bloco.title,
      local: "varredura de bloco não lido pela análise principal",
      tipo: defeito.tipo,
      descricao:
        `A varredura rápida apontou este defeito no bloco "${bloco.title}" (págs. ${bloco.startPage}-${bloco.endPage}), ` +
        `que a análise principal não leu. Probabilidade medida: ${bruta.noul.toFixed(2)}.`,
      /*
       * A EVIDÊNCIA É O BLOCO, e isto precisa ficar explícito no texto.
       *
       * `filterGroundedFindings` exige que o trecho citado exista no documento,
       * e é uma trava que tem de continuar valendo. A rede não produz trecho —
       * ela responde sobre o bloco inteiro. Citar as páginas em vez de inventar
       * um trecho é o que mantém o achado honesto e a trava intacta.
       */
      evidencia: `(varredura do bloco "${bloco.title}", págs. ${bloco.startPage}-${bloco.endPage} — sem trecho exato)`,
      conflito: defeito.conflito,
      sugestao_correcao: defeito.sugestao,
    } as AuditFinding);
  }

  return achados;
}

/**
 * QUAIS BLOCOS NINGUÉM LEU DE VERDADE. Puro, e a armadilha mora aqui.
 *
 * "Não está na lista de blocos que foram ao modelo" NÃO é o mesmo que "ninguém
 * leu". No Profundo o plano de blocos é ZERO por desenho, porque a leitura
 * global manda o documento inteiro de uma vez — `blocos_planejados` existe em
 * `CoberturaDoArquivo` justamente para distinguir "ia ler 8 e leu 0" de "ia ler
 * 0 porque a global lê tudo". Varrer "todos os blocos" nesse caso seria varrer
 * o que acabou de ser lido pelo modelo mais caro do sistema, e encher o parecer
 * de achados de rede sobre páginas que o `sol` já olhou com atenção.
 *
 * O buraco real é a interseção: bloco que NÃO foi ao modelo por bloco E que
 * caiu fora do que a leitura global coube. Os blocos vêm em ordem de documento,
 * então o corte da global é uma soma corrida de caracteres.
 */
export function blocosNaoLidos(
  blocos: AuditTextChunk[],
  idsLidosPorBloco: Set<string>,
  caracteresLidosPelaGlobal: number,
) {
  const naoLidos: AuditTextChunk[] = [];
  let acumulado = 0;

  for (const bloco of blocos) {
    const comecaEm = acumulado;
    acumulado += bloco.text.length;

    if (idsLidosPorBloco.has(bloco.id)) {
      continue;
    }

    /*
     * Coberto pela global quando o bloco INTEIRO cabe no que ela mandou. Um
     * bloco cortado ao meio pelo teto conta como não lido: o modelo viu o
     * começo dele sem o fim, e é exatamente aí que o achado se perde.
     */
    if (acumulado <= caracteresLidosPelaGlobal) {
      continue;
    }

    // Nem o começo do bloco entrou? Então é buraco cheio. Entrou parcialmente?
    // Também varre — meia leitura não é leitura.
    void comecaEm;
    naoLidos.push(bloco);
  }

  return naoLidos;
}

/**
 * Varre TODOS os blocos que a análise principal não leu.
 *
 * `lidos` são os ids dos blocos que foram ao modelo grande. O que sobra é
 * exatamente o buraco que hoje o parecer só consegue declarar.
 */
export async function varrerOQueNinguemLeu(
  blocos: AuditTextChunk[],
  lidos: Set<string>,
  arquivo: string,
  caracteresLidosPelaGlobal: number,
  contexto?: { userEmail?: string | null; conversationId?: string | null },
): Promise<AuditFinding[]> {
  const naoLidos = blocosNaoLidos(blocos, lidos, caracteresLidosPelaGlobal);

  if (naoLidos.length === 0) {
    return [];
  }

  const achados: AuditFinding[] = [];
  const LARGURA = 6;

  for (let inicio = 0; inicio < naoLidos.length; inicio += LARGURA) {
    const lote = naoLidos.slice(inicio, inicio + LARGURA);
    const respostas = await Promise.all(
      lote.map((bloco) => varrerBloco(bloco, arquivo, contexto)),
    );

    for (const doBloco of respostas) {
      achados.push(...doBloco);
    }
  }

  return achados;
}
