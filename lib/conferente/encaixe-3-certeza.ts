/**
 * ENCAIXE 3 — certeza MEDIDA em vez de string que o modelo escreveu sobre si.
 *
 * O QUE ESTAVA ERRADO NA ENTRADA DA MATRIZ
 *
 * `lib/severidade.ts` decide a prioridade por consequência × certeza, e a regra
 * dela é boa: *a consequência define a faixa; a certeza move dentro dela, nunca
 * para fora*. O problema nunca foi a regra — foi a CERTEZA que entra nela.
 *
 * Para achado de IA, `finding.confianca` é um campo de texto que o próprio
 * modelo escreveu a respeito de si mesmo, com três valores possíveis. Não é
 * calibrado, não é comparável entre dois achados e não é ordenável: dois
 * achados "alta" podem ser 0,95 e 0,55 e ninguém consegue saber qual é qual.
 * A matriz então ordena a lista do engenheiro por um número que não existe.
 *
 * Aqui esse insumo vira uma PROBABILIDADE medida, na mesma escala para todos os
 * achados. Nenhuma linha da matriz muda. É troca de entrada, não de regra.
 *
 * AS TRÊS TRAVAS, e por que cada uma existe
 *
 * 1. ACHADO DE REGRA NÃO É PERGUNTADO. Ele foi verificado por comparação
 *    determinística e `severidade.ts` já o trata como certeza máxima. Perguntar
 *    abriria a porta para o conferente rebaixá-lo — que é exatamente o que a
 *    regra de ouro proíbe. Ele nem entra na fila.
 *
 * 2. A FAIXA SÓ É USADA QUANDO NINGUÉM DECLAROU. O `impacto` declarado pelo
 *    modelo tem precedência (é o que `classifyFindingImpact` já faz), e a
 *    heurística de escopo vem depois. O conferente entra no terceiro lugar da
 *    fila: só quando os dois primeiros não responderam. Ele nunca rebaixa uma
 *    faixa que alguém já afirmou — no máximo preenche o vazio, que hoje cai
 *    num fallback de string.
 *
 * 3. TODA `choice` TEM "insufficient". É a mitigação obrigatória contra o que a
 *    medição independente mostrou: no indecidível o modelo fica CONFIANTEMENTE
 *    ERRADO (44,7% de acerto a P=0,74). Metade das perguntas sobre memorial é
 *    indecidível a partir do trecho — sem essa saída, ele inventa uma faixa com
 *    confiança alta, que é o pior dos mundos.
 *
 * ALTA E BAIXA NÃO SÃO SIMÉTRICAS AQUI
 *
 * Os cortes de `grauDaCerteza` são deliberadamente tortos: 0,80 para subir e
 * 0,45 para descer. Subir move o achado para o TETO da faixa e só custa atenção
 * do engenheiro; descer o move para o PISO e é o começo do caminho que fez
 * achado sumir em agosto/2026. Quando a medição é ambígua, o empate vai para o
 * meio, nunca para baixo.
 */

import type { AuditFinding, FindingImpact } from "@/lib/audit-report";

import { grauDaCerteza, type CertezaMedida } from "./certeza";
import { perguntarAoConferente, type Pergunta } from "./jev";

export { grauDaCerteza };
export type { CertezaMedida };

const FAIXA_POR_OPCAO: Record<string, FindingImpact> = {
  blocks_issue: "critico_documental",
  needs_decision: "tecnico_contratual",
  editorial: "revisao_editorial",
};

/*
 * As perguntas vão em INGLÊS e o `state` fica em português — ver o cabeçalho de
 * `jev.ts`. A rubrica repete, em inglês, a mesma definição de faixa que
 * `lib/faixas-de-impacto.ts` usa com os modelos grandes: se as duas descrições
 * divergirem, o conferente e o `sol` passam a classificar por réguas
 * diferentes, e a divergência aparece como ruído em vez de sinal.
 */
export const PERGUNTAS: Record<string, Pergunta> = {
  is_real_defect: {
    type: "noul",
    instructions:
      "Is the reported issue an objective defect in the quoted excerpt, rather than a correct passage the reviewer misread?",
    criteria: {
      true: "A reader can confirm the defect from the quoted text alone: a contradiction between two quoted passages, a wrong unit, an arithmetic total that does not close, a reference to something the document never declares, or leftover text naming a different project or organization.",
      false: "The quoted passage is correct as written, or the two passages are compatible because one is a specific case of the other (a leaner sub-base under a structural slab, a longer cure for one surface). Unusual or terse wording is not a defect.",
    },
  },
  decidable: {
    type: "noul",
    instructions: "Does the quoted excerpt contain enough information to decide, without any other document?",
    criteria: {
      true: "Everything needed to judge is quoted here.",
      false: "Deciding would require the drawings, another volume, the text of a standard, or field data that is not quoted here.",
    },
  },
  band: {
    type: "choice",
    instructions: "What is the consequence of this issue for issuing the document?",
    criteria: {
      blocks_issue:
        "Prevents issuing: the work's identity or location is wrong, a field was left as a template placeholder, the document contradicts itself so neither reading can be applied, an arithmetic total does not close, or a unit is wrong by an order of magnitude.",
      needs_decision:
        "Does not prevent issuing, but a responsible engineer must decide before execution: a superseded standard edition, conflicting specifications across chapters, an unproven premise, ambiguous scope, or leftover generic text that does not name another project.",
      editorial: "Wording, spelling or formatting only; it changes no technical decision and no quantity.",
      insufficient: "The excerpt does not allow choosing among the three above.",
    },
  },
};

/**
 * O `state` de um achado: o que o conferente precisa ler para decidir.
 *
 * NÃO VAI O DOCUMENTO INTEIRO, e não é economia — é precisão. A pergunta é
 * sobre ESTE trecho; mandar o memorial junto convida o modelo a decidir pelo
 * contexto geral ("é um memorial de obra pública, deve estar certo") em vez de
 * pelo que está citado. O trecho, o conflito e o local é o que um revisor
 * humano leria para dar o mesmo veredito.
 */
export function estadoDoAchado(finding: AuditFinding) {
  return [
    `Tipo: ${finding.tipo}`,
    finding.capitulo ? `Capítulo: ${finding.capitulo}` : null,
    finding.local ? `Local: ${finding.local}` : null,
    finding.pagina ? `Página: ${finding.pagina}` : null,
    `Evidência citada do documento: ${finding.evidencia}`,
    `Conflito apontado: ${finding.conflito}`,
    finding.referencia_comparada ? `Referência comparada: ${finding.referencia_comparada}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Mede a certeza de um achado. `null` = não perguntei (e quem chama segue como hoje).
 */
export async function medirCertezaDoAchado(
  finding: AuditFinding,
  contexto?: { userEmail?: string | null; conversationId?: string | null },
): Promise<CertezaMedida | null> {
  // Trava 1: achado de regra não é perguntado.
  if (finding.origem === "regra") {
    return null;
  }

  const resposta = await perguntarAoConferente({
    estado: estadoDoAchado(finding),
    perguntas: PERGUNTAS,
    operacao: "conferente-certeza",
    userEmail: contexto?.userEmail,
    conversationId: contexto?.conversationId,
  });

  if (!resposta) {
    return null;
  }

  const real = resposta.respostas.is_real_defect;
  const decidivel = resposta.respostas.decidable;
  const faixa = resposta.respostas.band;

  if (!real || real.type !== "noul") {
    return null;
  }

  /*
   * `decidable` NÃO MULTIPLICA — e a primeira versão deste arquivo multiplicava.
   *
   * MEDIDO em 21/09/2026, nos 13 casos de `prova-conferente-certeza.ts`: a
   * decidibilidade fica baixa para QUASE TUDO (0,22 a 0,48), porque conferir
   * quase qualquer achado de memorial "precisaria de outro documento" numa
   * leitura estrita — a prancha, o catálogo da ABNT, o volume 2. Multiplicar
   * por ela afundava junto os achados que estão certos: o "0,254 microns",
   * que é erro de mil vezes e eu conferi no PDF, saía a 0,26 (0,83 x 0,31) e
   * cairia no PISO da faixa. Isso é exatamente o caminho pelo qual achado
   * sumiu em agosto/2026, reencenado com um número novo.
   *
   * A decidibilidade agora só faz o que é seguro: SEGURA A PROMOÇÃO. Ela impede
   * um achado indecidível de chegar ao teto da faixa, e não empurra ninguém
   * para o piso. É a mesma assimetria do resto do arquivo — subir custa
   * atenção, descer custa o achado.
   */
  const decidibilidade = decidivel && decidivel.type === "noul" ? decidivel.noul : 1;
  const probabilidade = Math.min(1, Math.max(0, real.noul));

  const medida: CertezaMedida = {
    findingId: finding.id,
    probabilidade,
    decidibilidade,
  };

  /*
   * FAIXA SÓ COM CONFIANÇA, e o corte veio de um caso real.
   *
   * O falso positivo do 117-25 ("UBS VILA MANAUS" x "Unidade Básica de Saúde
   * Vila Manaus") não se denuncia pelo `is_real_defect` — ele saiu a 0,55, no
   * meio do caminho. Quem o denuncia é a CONFIANÇA DA FAIXA: 0,25, com a
   * probabilidade espalhada entre três opções (0,43 / 0,30 / 0,26). Os casos
   * claros vieram entre 0,91 e 1,00.
   *
   * Confiança espalhada é o conferente dizendo que não sabe sem usar a palavra
   * "insufficient", e aceitar essa faixa seria deixá-lo classificar no chute.
   */
  if (
    faixa &&
    faixa.type === "choice" &&
    faixa.choice !== "insufficient" &&
    faixa.confidence >= 0.6
  ) {
    const sugerida = FAIXA_POR_OPCAO[faixa.choice];

    if (sugerida) {
      medida.faixaSugerida = sugerida;
      medida.confiancaDaFaixa = faixa.confidence;
    }
  }

  return medida;
}

/**
 * Mede uma lista inteira, em paralelo controlado.
 *
 * O limite de vazão do Jev é 1.200 req/min, e 56 achados cabem folgados. O
 * teto de 8 aqui não é do fornecedor: é para a camada opcional não disputar
 * soquete com as chamadas do `sol`, que são as que o parecer realmente espera.
 */
export async function medirCertezaDaLista(
  findings: AuditFinding[],
  contexto?: { userEmail?: string | null; conversationId?: string | null },
): Promise<Map<string, CertezaMedida>> {
  const medidas = new Map<string, CertezaMedida>();
  const fila = findings.filter((finding) => finding.origem !== "regra");
  const LARGURA = 8;

  for (let inicio = 0; inicio < fila.length; inicio += LARGURA) {
    const lote = fila.slice(inicio, inicio + LARGURA);
    const respostas = await Promise.all(
      lote.map((finding) => medirCertezaDoAchado(finding, contexto)),
    );

    for (const medida of respostas) {
      if (medida) {
        medidas.set(medida.findingId, medida);
      }
    }
  }

  return medidas;
}
