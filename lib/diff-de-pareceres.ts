/**
 * O QUE MUDOU ENTRE DUAS AUDITORIAS do mesmo memorial.
 *
 * O delta do memorial (`audit-fingerprint.ts`) responde o que mudou no
 * DOCUMENTO — quais capítulos entraram, saíram ou foram mexidos — e serve para
 * decidir se vale pagar uma releitura. Este arquivo responde a pergunta
 * seguinte, que é a de quem já pagou: dos problemas apontados da última vez,
 * quais sumiram, quais continuam de pé, e quais apareceram agora.
 *
 * POR QUE NÃO CASAR PELO ID
 *
 * O `id` do achado (`INC-001`) é POSICIONAL: sai da ordenação do parecer, e a
 * mesma ocorrência vira `INC-004` no parecer seguinte se três achados mais
 * graves entrarem na frente. Casar por id diria que tudo foi corrigido e tudo é
 * novo, ao mesmo tempo.
 *
 * POR QUE NÃO CASAR PELA PÁGINA
 *
 * Pela razão inversa: corrigir um memorial mexe na paginação. Um parágrafo
 * removido no capítulo 3 desce todo o resto do documento, e o achado da página
 * 40 passa a morar na 39 sem nada ter acontecido com ele. Página é o dado que
 * MAIS se move entre revisões — é por isso que a reancoragem existe em
 * `audit-reuso.ts`, e é por isso que ela não entra na chave daqui.
 *
 * O que sobra, e é o que se usa: o TIPO do defeito e o TRECHO citado. Os dois
 * descrevem o problema em si, e um problema que continua de pé continua sendo
 * citado com as mesmas palavras — se o trecho mudou, o texto mudou, e o achado
 * antigo deixou de existir de verdade.
 *
 * Puro: nada de IO, nada de modelo. Comparar dois pareceres não pode custar uma
 * terceira auditoria.
 */

import type { AuditFinding, AuditReport } from "./audit-report.ts";

export type DiffDePareceres = {
  /** Estavam no parecer anterior e não estão mais: o trecho saiu ou mudou. */
  corrigidos: AuditFinding[];
  /** Continuam apontados, com o mesmo tipo e o mesmo trecho. */
  persistentes: AuditFinding[];
  /** Não estavam no anterior. */
  novos: AuditFinding[];
};

function normalizar(valor: string): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A identidade de um achado ENTRE VERSÕES. Tipo + trecho, sem id e sem página.
 *
 * O trecho é cortado em 120 caracteres — o mesmo corte que a deduplicação da
 * auditoria usa — porque a cauda de uma evidência longa costuma trazer a
 * paginação e a numeração de item, que mudam sem que o defeito mude.
 */
export function chaveEntreVersoes(finding: AuditFinding): string {
  return `${normalizar(finding.tipo)}|${normalizar(finding.evidencia).slice(0, 120)}`;
}

/**
 * Compara dois pareceres do mesmo memorial.
 *
 * A ordem dos argumentos é a da leitura: o de ANTES primeiro. Trocá-los inverte
 * "corrigido" e "novo" — e nenhum dos dois é simétrico, então a assinatura é
 * nomeada e não posicional para quem chama não errar em silêncio.
 */
export function compararPareceres(args: {
  anterior: AuditReport;
  atual: AuditReport;
}): DiffDePareceres {
  const chavesDoAnterior = new Map<string, AuditFinding>();
  for (const finding of args.anterior.incongruencias) {
    // O primeiro de cada chave vence: duas ocorrências com o mesmo tipo e o
    // mesmo trecho são a mesma coisa dita duas vezes, e contá-las em dobro
    // inflaria "corrigidos" quando uma delas saísse.
    if (!chavesDoAnterior.has(chaveEntreVersoes(finding))) {
      chavesDoAnterior.set(chaveEntreVersoes(finding), finding);
    }
  }

  const persistentes: AuditFinding[] = [];
  const novos: AuditFinding[] = [];
  const vistas = new Set<string>();

  for (const finding of args.atual.incongruencias) {
    const chave = chaveEntreVersoes(finding);
    vistas.add(chave);
    if (chavesDoAnterior.has(chave)) persistentes.push(finding);
    else novos.push(finding);
  }

  const corrigidos = [...chavesDoAnterior.entries()]
    .filter(([chave]) => !vistas.has(chave))
    .map(([, finding]) => finding);

  return { corrigidos, persistentes, novos };
}

/**
 * A frase de uma linha que vai para a tela. Fora do componente porque ela é
 * decisão de conteúdo — o que vale a pena dizer e em que ordem —, e porque
 * assim dá para prová-la sem navegador.
 *
 * A ordem não é arbitrária: primeiro o que saiu (é o efeito do trabalho de
 * quem corrigiu), depois o que apareceu (é a notícia ruim, e precisa ser vista),
 * e por último o que ficou. Devolve "" quando não há nada a dizer — parecer
 * idêntico não merece uma faixa na tela.
 */
export function resumoDoDiff(diff: DiffDePareceres): string {
  const partes: string[] = [];
  const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

  if (diff.corrigidos.length > 0) {
    partes.push(`${plural(diff.corrigidos.length, "achado saiu", "achados saíram")}`);
  }
  if (diff.novos.length > 0) {
    partes.push(`${plural(diff.novos.length, "achado novo", "achados novos")}`);
  }
  if (diff.persistentes.length > 0) {
    partes.push(`${plural(diff.persistentes.length, "continua", "continuam")} de pé`);
  }

  return partes.join(" · ");
}
