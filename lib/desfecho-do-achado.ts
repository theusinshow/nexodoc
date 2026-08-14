/**
 * COMO um achado é encerrado, e o que isso grava.
 *
 * O schema separa duas perguntas de propósito — o comentário de `AuditFeedback`
 * em [[../prisma/schema.prisma]] conta a história: `verdict` julga a AUDITORIA
 * ("procede?") e alimenta o benchmark do motor; `resolvedAt` conta o TRABALHO
 * ("já corrigi?"). São independentes, e o caso normal é um achado procedente e
 * já corrigido.
 *
 * Este módulo é quem sabe qual desfecho toca qual eixo. Só um dos três toca os
 * dois, e errar isso contamina o benchmark com achados que ninguém disse serem
 * falsos — um estrago silencioso, que só aparece quando alguém confia na
 * métrica para decidir trocar de modelo.
 *
 * Puro: nenhum IO, nenhuma data implícita. `agora` entra por parâmetro para o
 * teste não depender do relógio.
 */
export type Desfecho = "FIXED_IN_DOC" | "FALSE_POSITIVE" | "ACCEPTED_RISK";

const DESFECHOS: readonly string[] = ["FIXED_IN_DOC", "FALSE_POSITIVE", "ACCEPTED_RISK"];

/** O mesmo teto da coluna `note` em `AuditFeedback`. */
const LIMITE_DA_NOTA = 1000;

export type GravacaoDoDesfecho = {
  resolutionKind: Desfecho;
  resolvedAt: Date;
  /** Só o falso positivo julga a IA. Os outros dois não dizem nada sobre ela. */
  verdict?: "FALSE_POSITIVE";
  note: string;
};

export class DesfechoInvalido extends Error {
  /*
   * Campo declarado e atribuído à mão, e não propriedade de parâmetro: o node
   * roda os testes de `scripts/` em modo strip-only, que apaga tipos sem
   * transformar sintaxe. Mesmo motivo de `AccessDenied` em [[actor.ts]].
   */
  readonly motivo: string;

  constructor(motivo: string) {
    super(motivo);
    this.name = "DesfechoInvalido";
    this.motivo = motivo;
  }
}

export function gravacaoDoDesfecho(args: {
  desfecho: string;
  note?: string;
  agora: Date;
}): GravacaoDoDesfecho {
  if (!DESFECHOS.includes(args.desfecho)) {
    throw new DesfechoInvalido("Desfecho desconhecido.");
  }

  const desfecho = args.desfecho as Desfecho;

  /*
   * A nota é aparada antes de ser julgada: espaço em volta não é justificativa,
   * e aceitar "   " como decisão técnica escrita seria deixar a regra passar
   * por uma porta que ninguém vê.
   */
  const note = (args.note ?? "").trim().slice(0, LIMITE_DA_NOTA);

  /*
   * OBRIGATÓRIA NA DECISÃO TÉCNICA, e só nela. "Corrigi" e "não era erro" se
   * explicam sozinhos; assumir um risco, não — e é essa a decisão que alguém
   * vai ter que defender depois de o documento estar emitido.
   */
  if (desfecho === "ACCEPTED_RISK" && !note) {
    throw new DesfechoInvalido("Decisão técnica exige uma justificativa escrita.");
  }

  return {
    resolutionKind: desfecho,
    resolvedAt: args.agora,
    ...(desfecho === "FALSE_POSITIVE" ? { verdict: "FALSE_POSITIVE" as const } : {}),
    note,
  };
}
