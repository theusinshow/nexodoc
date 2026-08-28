/**
 * DA CONFERÊNCIA AGREGADA PARA A FOLHA — a tradução, sem React.
 *
 * A conferência leve fala do CONJUNTO ("pranchas com revisões divergentes"), e
 * o canvas precisa marcar UM nó. Desde 28/08/2026 cada achado carrega as folhas
 * envolvidas (`LightCheckFinding.folhas`); aqui elas viram um índice por folha,
 * com a PIOR severidade que a alcança.
 *
 * PIOR, e não a primeira: uma prancha que está ao mesmo tempo num aviso de
 * revisão e num crítico de código é crítica. Mostrar o aviso porque ele veio
 * antes na lista rebaixaria o problema na única tela em que ele seria visto.
 *
 * PURO: roda no node cru.
 */

export type SeveridadeDaFolha = "critico" | "aviso" | "info";

interface AchadoComFolhas {
  severidade: string;
  campo: string;
  mensagem: string;
  folhas?: string[];
}

const PESO: Record<SeveridadeDaFolha, number> = {
  info: 0,
  aviso: 1,
  critico: 2,
};

export interface DivergenciaDaFolha {
  severidade: SeveridadeDaFolha;
  /** As mensagens que alcançam esta folha, da mais grave para a menos. */
  motivos: string[];
}

function normalizar(s: string): SeveridadeDaFolha {
  return s === "critico" || s === "aviso" ? s : "info";
}

/**
 * Índice folha → o que pesa sobre ela.
 *
 * A chave é o mesmo `label` do `SeloFact` — o nome do arquivo da prancha. Quem
 * desenha o canvas casa por `fileName`, que é o dado que a folha já carrega;
 * inventar um id novo aqui criaria uma segunda identidade para a mesma prancha.
 */
export function divergenciasPorFolha(
  achados: readonly AchadoComFolhas[],
): Map<string, DivergenciaDaFolha> {
  const porFolha = new Map<string, DivergenciaDaFolha>();

  for (const achado of achados) {
    if (!achado.folhas || achado.folhas.length === 0) continue;
    const sev = normalizar(achado.severidade);
    for (const folha of achado.folhas) {
      const atual = porFolha.get(folha);
      if (!atual) {
        porFolha.set(folha, { severidade: sev, motivos: [achado.mensagem] });
        continue;
      }
      atual.motivos.push(achado.mensagem);
      if (PESO[sev] > PESO[atual.severidade]) atual.severidade = sev;
    }
  }

  // Os motivos ordenados pela gravidade seria mentira: a severidade é do
  // ACHADO, e o motivo não a carrega. Mantê-los na ordem em que a conferência
  // os produziu preserva a leitura de quem já viu o relatório.
  return porFolha;
}

/** Quantas folhas o índice acusa, por severidade — o resumo da coluna. */
export function contagemDaConferencia(
  indice: Map<string, DivergenciaDaFolha>,
): { critico: number; aviso: number; info: number } {
  const conta = { critico: 0, aviso: 0, info: 0 };
  for (const d of indice.values()) conta[d.severidade] += 1;
  return conta;
}
