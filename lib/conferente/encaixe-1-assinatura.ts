/**
 * ENCAIXE 1 — a segunda assinatura no achado de REGRA.
 *
 * O PROBLEMA QUE ESTE ENCAIXE ATACA
 *
 * `lib/decisao-da-validacao.ts` blinda o achado de regra: a validação por IA
 * não pode removê-lo nem rebaixá-lo. A blindagem está certa — regra não
 * alucina, cita página e evidência. Mas ela tem um custo que ninguém paga
 * explicitamente: QUANDO A REGEX ERRA, O ERRO VAI INTEIRO PARA O PARECER.
 *
 * Os casos estão escritos nos comentários do próprio código:
 *  - 117-25: a regra de identidade acusou "Unidade Básica de Saúde Vila Manaus"
 *    de divergir de "UBS VILA MANAUS". É o mesmo nome, um por extenso.
 *  - 084-25: gabarito com parêntese e a palavra "ginásio" solta.
 *  - marca: a regra exigia "ou similar" e recusava "Suvinil similar".
 *
 * Os três eram defeitos NOSSOS, e os três foram consertados por acaso, porque
 * alguém foi olhar. A camada que já sabia estava calada.
 *
 * O QUE ESTE ENCAIXE FAZ, E O QUE ELE NÃO PODE FAZER
 *
 * Ele dá uma segunda assinatura no achado de regra, com perguntas atômicas, e
 * quando discorda registra uma `ContestacaoDeRegra` — canal que JÁ EXISTE, já
 * vai para o parecer e já serve de fila para quem mexe nas regras.
 *
 * O ACHADO NÃO MUDA. Não é removido, não é rebaixado, não é recolhido. Ele
 * passa a carregar o desacordo junto. Quem decide mudar a regra é gente.
 *
 * POR QUE ATÔMICAS, E NÃO "ESTA REGRA ERROU?"
 *
 * A medição independente do fornecedor é clara: pergunta composta rende 62,6%,
 * e a mesma decisão decomposta rende 95% — pior que um modelo pequeno quando
 * composta. Decompor aqui não é otimização, é requisito. E não custa chamadas:
 * `questions` é um mapa, então as cinco perguntas viajam na mesma requisição,
 * pelo mesmo preço de entrada.
 */

import type { AuditFinding } from "@/lib/audit-report";
import { registrarContestacao, type ContestacaoDeRegra } from "@/lib/contestacao-de-regra";

import { perguntarAoConferente, type Pergunta, type RespostaNoul } from "./jev";

/*
 * A pergunta geral, que vale para qualquer regra. Ela pergunta pelo DEFEITO
 * DA REGRA, não pelo defeito do documento — é a inversão que faz este encaixe
 * ser útil: o conferente está auditando a nós, não ao memorial.
 */
const PERGUNTAS_GERAIS: Record<string, Pergunta> = {
  claim_holds: {
    type: "noul",
    instructions:
      "Does the reported conflict actually hold for the quoted excerpt, as opposed to the checker having misread it?",
    criteria: {
      true: "The two quoted passages really are incompatible, or the quoted text really does show what the report claims.",
      false: "The report misreads the excerpt: the passages are compatible, the supposed conflict is the same thing said twice, or the quoted text does not show what is claimed.",
    },
  },
  innocent_explanation: {
    type: "noul",
    instructions:
      "Is there an ordinary, innocent explanation that makes the quoted text correct as written?",
    criteria: {
      true: "An expansion of an acronym, a synonym, a specific case of a general rule, a caveat worded differently, or a legitimate repetition of boilerplate.",
      false: "No ordinary reading makes the quoted text correct.",
    },
  },
};

/*
 * IDENTIDADE é a família que mais produziu falso positivo blindado, e as
 * perguntas abaixo são os dois casos documentados virados pergunta. "É a mesma
 * obra?" é a pergunta COMPOSTA que não se deve fazer; estas são as partes dela.
 */
const PERGUNTAS_DE_IDENTIDADE: Record<string, Pergunta> = {
  is_abbreviation: {
    type: "noul",
    instructions: "Is one of the two names an acronym, abbreviation or short form of the other?",
    criteria: {
      true: 'One expands the other, such as "UBS Vila Manaus" and "Unidade Básica de Saúde Vila Manaus", or one drops a category word the other spells out.',
      false: "They name different things, not the same thing written two ways.",
    },
  },
  proper_nouns_match: {
    type: "noul",
    instructions: "Do the proper nouns — place names, neighbourhood, institution, numbers — coincide between the two names?",
    criteria: {
      true: "Every proper noun present in both agrees; one may simply carry fewer of them.",
      false: "A proper noun in one contradicts a proper noun in the other: a different municipality, a different institution, a different number.",
    },
  },
  divergent_qualifier: {
    type: "noul",
    instructions: "Does one name carry a qualifier that places it in a DIFFERENT work, rather than merely describing the same one?",
    criteria: {
      true: "A qualifier that changes which work is meant, such as a different city or a different building on another site.",
      false: 'A qualifier that only adds detail about the same work, such as a parenthesis ("Cobertura de Quadra") or a generic category word ("ginásio").',
    },
  },
};

/* Marca sem ressalva: a regra lê uma janela de 420 caracteres e erra a forma. */
const PERGUNTAS_DE_MARCA: Record<string, Pergunta> = {
  has_equivalence_caveat: {
    type: "noul",
    instructions: "Does the quoted excerpt allow an equivalent product, in ANY wording?",
    criteria: {
      true: 'Any wording that opens the specification: "ou similar", "ou equivalente", "similar" right after the brand, "de qualidade equivalente", "marca de referência".',
      false: "The brand is named with no opening for an equivalent product anywhere in the excerpt.",
    },
  },
};

function ehNoul(valor: unknown): valor is RespostaNoul {
  return Boolean(valor) && (valor as RespostaNoul).type === "noul";
}

/**
 * SÓ CONTESTA A REGRA CUJA PROVA CABE NO TRECHO. Este é o limite do encaixe.
 *
 * A primeira versão perguntava as gerais para TODA regra, e a prova reprovou:
 * ela contestou a regra de linguagem rodoviária do 025-24, que está certa. E
 * estava certa a resposta dela também — o conferente lê o trecho e a alegação,
 * e mais nada. Para saber que "eixo da rodovia" é resíduo, é preciso saber que
 * a obra é a urbanização de três praças, coisa que está na página 11 e não no
 * trecho. Ele respondeu "não sustenta" porque, do que lhe foi mostrado,
 * realmente não dá para sustentar.
 *
 * A conclusão não é ajustar o corte, é reconhecer a fronteira:
 *
 *   IDENTIDADE e MARCA se decidem DENTRO do trecho — "UBS Vila Manaus" é ou
 *   não é a forma curta de "Unidade Básica de Saúde Vila Manaus" lendo só os
 *   dois nomes; "Suvinil similar" abre ou não abre para equivalente lendo só a
 *   frase. São exatamente as duas famílias que produziram falso positivo
 *   blindado, e não é coincidência: regex erra justamente onde a decisão é de
 *   linguagem.
 *
 *   HIERARQUIA, RESÍDUO, PEÇA NÃO LISTADA e ARITMÉTICA se decidem contra o
 *   RESTO DO DOCUMENTO. Mandar o documento inteiro estouraria os 32k de state
 *   e, pior, trocaria uma decisão fechada por uma leitura — que é o trabalho
 *   do modelo grande, não desta camada.
 *
 * Fora dessas duas famílias o conferente ainda assina (a medição fica gravada
 * e dá para revisitar), mas NÃO contesta. Contestação errada ensina o time a
 * ignorar a coluna inteira, inclusive no dia em que ela acerta.
 */
type Familia = "identidade" | "marca" | "fora-do-alcance";

function familiaDoAchado(finding: AuditFinding): Familia {
  const tipo = finding.tipo.toLowerCase();

  if (tipo.includes("nome da obra") || tipo.includes("identidade") || tipo.includes("órgão divergente")) {
    return "identidade";
  }

  if (tipo.includes("marca")) {
    return "marca";
  }

  return "fora-do-alcance";
}

function perguntasDoAchado(familia: Familia): Record<string, Pergunta> {
  if (familia === "identidade") {
    return { ...PERGUNTAS_GERAIS, ...PERGUNTAS_DE_IDENTIDADE };
  }

  if (familia === "marca") {
    return { ...PERGUNTAS_GERAIS, ...PERGUNTAS_DE_MARCA };
  }

  return PERGUNTAS_GERAIS;
}

function estadoDoAchadoDeRegra(finding: AuditFinding) {
  return [
    `A regra automática "${finding.tipo}" acusou o documento.`,
    finding.pagina ? `Página: ${finding.pagina}` : null,
    finding.local ? `Local: ${finding.local}` : null,
    `Trecho citado do documento: ${finding.evidencia}`,
    `Conflito alegado pela regra: ${finding.conflito}`,
    finding.referencia_comparada ? `Comparado com: ${finding.referencia_comparada}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * O CORTE QUE DECIDE SE HÁ CONTESTAÇÃO.
 *
 * É deliberadamente difícil discordar. Contestação é ruído no parecer quando
 * está errada, e quem a lê é o engenheiro — não pode virar um aviso por achado.
 * Por isso exige DUAS coisas ao mesmo tempo: que a alegação da regra não se
 * sustente E que exista uma explicação inocente. Uma só das duas não basta.
 *
 * 0,6 e não 0,5 porque a calibração de fábrica não foi conferida com dado
 * nosso (o ECE publicado é 4,4x o piso) e o erro caro aqui é contestar regra
 * que está certa — isso ensina o time a ignorar a contestação, e aí ela deixa
 * de servir para o caso em que está certa.
 */
const CORTE = 0.6;

export type AssinaturaDeRegra = {
  findingId: string;
  /** P(a alegação da regra se sustenta). */
  sustenta: number;
  /** P(existe explicação inocente para o trecho). */
  inocente: number;
  /** "fora-do-alcance" = assinado e gravado, mas nunca contestado. */
  familia: Familia;
  contestacao?: ContestacaoDeRegra;
};

export async function assinarAchadoDeRegra(
  finding: AuditFinding,
  contexto?: { userEmail?: string | null; conversationId?: string | null },
): Promise<AssinaturaDeRegra | null> {
  // Só achado de REGRA: o de IA já passa pela validação e pelo Encaixe 3.
  if (finding.origem !== "regra") {
    return null;
  }

  const familia = familiaDoAchado(finding);
  const perguntas = perguntasDoAchado(familia);
  const resposta = await perguntarAoConferente({
    estado: estadoDoAchadoDeRegra(finding),
    perguntas,
    operacao: "conferente-assinatura",
    userEmail: contexto?.userEmail,
    conversationId: contexto?.conversationId,
  });

  if (!resposta) {
    return null;
  }

  const sustentaResposta = resposta.respostas.claim_holds;
  const inocenteResposta = resposta.respostas.innocent_explanation;

  if (!ehNoul(sustentaResposta)) {
    return null;
  }

  const sustenta = sustentaResposta.noul;
  const inocente = ehNoul(inocenteResposta) ? inocenteResposta.noul : 0;
  const assinatura: AssinaturaDeRegra = { findingId: finding.id, sustenta, inocente, familia };

  // Fora das duas famílias autocontidas o conferente assina e cala — ver acima.
  if (familia === "fora-do-alcance") {
    return assinatura;
  }

  const nota = (nome: string) => {
    const bruta = resposta.respostas[nome];
    return ehNoul(bruta) ? bruta.noul : null;
  };

  /*
   * QUEM DECIDE A CONTESTAÇÃO É A PERGUNTA ESPECÍFICA, não a geral.
   *
   * A geral ("a alegação se sustenta?") mediu 0,48 no falso positivo do 117-25
   * — em cima do muro, e por um bom motivo: ela pergunta sobre a alegação
   * inteira de uma vez, que é justamente a pergunta composta que a decomposição
   * existe para evitar. As específicas, no mesmo caso, foram 0,84 / 0,84 / 0,94.
   * Usar a geral como portão era desfazer a decomposição no último passo.
   *
   * A geral vira DESEMPATE: ela só impede a contestação quando afirma com
   * força que a regra está certa, e aí a discordância entre as duas camadas é
   * sinal de que nenhuma das duas deve falar.
   */
  const sigla = nota("is_abbreviation");
  const nomesBatem = nota("proper_nouns_match");
  const qualificadorDiverge = nota("divergent_qualifier");
  const abreParaEquivalente = nota("has_equivalence_caveat");

  const discorda =
    familia === "marca"
      ? (abreParaEquivalente ?? 0) >= CORTE
      : ((sigla ?? 0) >= CORTE || (nomesBatem ?? 0) >= CORTE) &&
        (qualificadorDiverge ?? 1) < CORTE;

  // Desempate: regra sustentada com força cala a contestação.
  if (!discorda || sustenta >= 0.75) {
    return assinatura;
  }

  /*
   * O MOTIVO DIZ QUAL PERGUNTA DISCORDOU, e não só que houve discordância.
   *
   * Contestação sem o porquê vira "a IA não gostou", em cima de que ninguém
   * consegue agir. Nomear a pergunta atômica que virou é o que transforma isto
   * num bug report: "um nome é sigla do outro (0,84)" aponta direto para a
   * linha da regra que precisa mudar.
   */
  const detalhes: string[] = [];

  if ((sigla ?? 0) >= CORTE) {
    detalhes.push(`um nome é sigla/forma curta do outro (${sigla!.toFixed(2)})`);
  }

  if ((nomesBatem ?? 0) >= CORTE) {
    detalhes.push(`os nomes próprios coincidem (${nomesBatem!.toFixed(2)})`);
  }

  if (qualificadorDiverge !== null && qualificadorDiverge < CORTE) {
    detalhes.push(
      `o qualificador não muda de qual obra se fala (${(1 - qualificadorDiverge).toFixed(2)})`,
    );
  }

  if ((abreParaEquivalente ?? 0) >= CORTE) {
    detalhes.push(`o trecho abre para equivalente (${abreParaEquivalente!.toFixed(2)})`);
  }

  const motivo =
    detalhes.length > 0
      ? `O conferente discorda da regra: ${detalhes.join("; ")}.`
      : `O conferente não sustenta a alegação da regra (${sustenta.toFixed(2)}) e vê explicação inocente para o trecho (${inocente.toFixed(2)}).`;

  assinatura.contestacao = registrarContestacao(finding, motivo);

  return assinatura;
}

/** Assina a lista inteira. Devolve só as contestações — o achado não muda. */
export async function assinarAchadosDeRegra(
  findings: AuditFinding[],
  contexto?: { userEmail?: string | null; conversationId?: string | null },
): Promise<ContestacaoDeRegra[]> {
  const deRegra = findings.filter((finding) => finding.origem === "regra");
  const contestacoes: ContestacaoDeRegra[] = [];
  const LARGURA = 8;

  for (let inicio = 0; inicio < deRegra.length; inicio += LARGURA) {
    const lote = deRegra.slice(inicio, inicio + LARGURA);
    const assinaturas = await Promise.all(
      lote.map((finding) => assinarAchadoDeRegra(finding, contexto)),
    );

    for (const assinatura of assinaturas) {
      if (assinatura?.contestacao) {
        contestacoes.push(assinatura.contestacao);
      }
    }
  }

  return contestacoes;
}
