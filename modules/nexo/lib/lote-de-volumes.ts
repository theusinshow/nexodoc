/**
 * MONTAR VOLUMES EM LOTE — uma conferência por gesto (última onda da frente A,
 * 15/09/2026).
 *
 * "Montar os N volumes" e "Remontar e baixar" chamam, por volume, o `confirm`
 * que o cartão registrou (`montadores-de-volume.tsx`). Cada `confirm` pergunta
 * ao servidor a versão antes da conferência paga — N volumes eram N perguntas
 * iguais no mesmo clique. Aqui o lote pergunta uma vez: desatualizada, recusa
 * tudo de uma vez, com o motivo; em dia, cada montagem recebe `jaConferido`.
 *
 * Sequencial, cada volume no seu `try`: cada um carrega dezenas de megabytes, e
 * um que falha não pode levar os outros junto nem sumir em silêncio.
 *
 * PURO e sem imports: roda no node cru (`scripts/test-lote-de-volumes.ts`).
 */

export type MontarVolume = (opcoes?: {
  jaConferido?: boolean;
}) => Promise<string | null>;

export type ConferenciaDoLote =
  { pode: true } | { pode: false; motivo: string };

export async function montarEmLote(args: {
  itens: readonly {
    id: string;
    rotulo: string;
    montar: MontarVolume | undefined;
    /** Sem montador: conta como falha com esta frase (sem ela, é pulado). */
    faltando?: string;
  }[];
  conferir: () => Promise<ConferenciaDoLote>;
  aoComecar?: (indice: number) => void;
}): Promise<{
  recusado: string | null;
  falhas: { rotulo: string; motivo: string }[];
  refeitos: string[];
}> {
  const falhas: { rotulo: string; motivo: string }[] = [];
  const refeitos: string[] = [];
  if (args.itens.some((item) => item.montar)) {
    const conferencia = await args.conferir();
    if (!conferencia.pode)
      return { recusado: conferencia.motivo, falhas, refeitos };
  }
  for (let i = 0; i < args.itens.length; i++) {
    const item = args.itens[i];
    if (!item.montar) {
      if (item.faltando)
        falhas.push({ rotulo: item.rotulo, motivo: item.faltando });
      continue;
    }
    args.aoComecar?.(i);
    try {
      const motivo = await item.montar({ jaConferido: true });
      if (motivo) falhas.push({ rotulo: item.rotulo, motivo });
      else refeitos.push(item.id);
    } catch (err) {
      // Rede de segurança: o cartão devolve o motivo em vez de lançar, mas um
      // erro fora do `try` dele não pode parar o laço.
      falhas.push({
        rotulo: item.rotulo,
        motivo: err instanceof Error ? err.message : "erro desconhecido",
      });
    }
  }
  return { recusado: null, falhas, refeitos };
}
