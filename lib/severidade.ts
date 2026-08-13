/**
 * A matriz de severidade: consequência × certeza, e o motivo escrito.
 *
 * O QUE ESTE ARQUIVO NÃO PODE VIRAR
 *
 * Em 12/08/2026 quatro regras que mandavam CALAR foram removidas do auditor
 * porque escondiam achado, e a decisão do escritório ficou: reportar tudo e
 * classificar por consequência. "Apertar a severidade" é a porta pela qual esse
 * erro volta — basta rebaixar um achado até ele sumir da leitura.
 *
 * Por isso a regra desta matriz é uma só, e é a garantia:
 *
 *   A CONSEQUÊNCIA DEFINE A FAIXA. A CERTEZA MOVE DENTRO DELA, NUNCA PARA FORA.
 *
 * Um achado que impede a emissão é Alta mesmo lido com confiança baixa — a
 * dúvida já é dita em outro lugar (a camada `sugestao`, o selo de confiança,
 * o "◻ Sugerido" do cartão), e dizê-la duas vezes custaria o lugar dele na
 * lista. Nada aqui remove, filtra ou recolhe achado: esta função só escolhe
 * um rótulo e escreve por quê.
 *
 * POR QUE DETERMINÍSTICO, E NÃO PERGUNTADO AO MODELO
 *
 * A prioridade vinha do modelo, campo livre, e por isso dois achados idênticos
 * em documentos diferentes saíam com prioridades diferentes. Derivá-la das duas
 * grandezas que o achado JÁ declara custa zero token e dá a mesma resposta toda
 * vez. E o `motivo` é o que torna o critério auditável em vez de opaco: dá para
 * discordar de uma frase escrita; de um número que ninguém explica, não.
 */

import type { AuditFinding, FindingImpact, FindingPriority } from "./audit-report.ts";
import { classifyFindingImpact } from "./audit-report.ts";

export type SeveridadeDoAchado = {
  prioridade: FindingPriority;
  /** Uma frase nomeando os dois eixos. Vai para `severity_reason` do achado. */
  motivo: string;
};

/**
 * A faixa de cada consequência: piso e teto. A certeza escolhe entre os dois —
 * e não tem como sair daqui, que é a razão de a faixa existir.
 */
const FAIXA: Record<FindingImpact, { teto: FindingPriority; piso: FindingPriority }> = {
  // Faixa de um degrau só: impedir a emissão é a consequência máxima, e
  // nenhuma dose de incerteza a torna menos impeditiva.
  critico_documental: { teto: "Alta", piso: "Alta" },
  tecnico_contratual: { teto: "Media/Alta", piso: "Media" },
  revisao_editorial: { teto: "Media", piso: "Baixa" },
};

const MEIO: Partial<Record<FindingImpact, FindingPriority>> = {
  revisao_editorial: "Baixa/Media",
};

const CONSEQUENCIA: Record<FindingImpact, string> = {
  critico_documental: "impede emitir o documento",
  tecnico_contratual: "exige decisão do responsável técnico antes de executar",
  revisao_editorial: "não muda decisão técnica",
};

/**
 * A certeza do achado, em três degraus. Achado de REGRA conta como o degrau de
 * cima independentemente do campo `confianca`: ele foi verificado por
 * comparação determinística, não por leitura — não tem como alucinar, e a
 * confiança que o modelo declarou não fala dele.
 */
function certeza(finding: AuditFinding): { grau: "alta" | "media" | "baixa"; texto: string } {
  if (finding.origem === "regra") {
    return { grau: "alta", texto: "verificado por regra" };
  }

  if (finding.confianca === "alta") return { grau: "alta", texto: "leitura de confiança alta" };
  if (finding.confianca === "baixa") return { grau: "baixa", texto: "leitura de confiança baixa" };
  return { grau: "media", texto: "leitura de confiança média" };
}

/**
 * A prioridade do achado e a frase que a explica.
 *
 * Não recebe nem devolve lista: uma decisão por achado, sem olhar os vizinhos.
 * Severidade que depende de quantos outros achados existem é a que produz
 * "este é menos grave porque hoje tem muita coisa grave" — exatamente o
 * raciocínio que sumiu com achados em agosto.
 */
export function severidadeDoAchado(finding: AuditFinding): SeveridadeDoAchado {
  const impacto = finding.impacto ?? classifyFindingImpact(finding);
  const faixa = FAIXA[impacto];
  const { grau, texto } = certeza(finding);

  const prioridade =
    grau === "alta" ? faixa.teto : grau === "baixa" ? faixa.piso : (MEIO[impacto] ?? faixa.piso);

  // Faixa de um degrau só: dizer "Alta–Alta" seria charada. Dizer que ela não
  // se move é a informação que o leitor precisa para conferir a conta.
  const regra =
    faixa.piso === faixa.teto
      ? `Faixa fixa em ${faixa.teto}: incerteza não atenua consequência máxima.`
      : `Faixa ${faixa.piso}–${faixa.teto}.`;

  return {
    prioridade,
    motivo: `Consequência: ${CONSEQUENCIA[impacto]}. Certeza: ${texto}. ${regra}`,
  };
}
