/**
 * Operações PURAS sobre a lista de resultados gerados da conversa.
 *
 * SEM IMPORTS de runtime (nem alias `@/`): roda no node cru do
 * `test:nexo:session`. O store faz os efeitos (revogar object URL, persistir);
 * aqui só a transformação da lista, que é o que precisa ficar travado por teste.
 */

/** Mínimo que a remoção precisa enxergar de um resultado (o store passa o dele). */
interface ResultoRemovivel {
  artifactId: string;
  files: { url: string }[];
}

/**
 * Tira UM artefato da lista pelo id. Devolve os restantes NA ORDEM ORIGINAL e o
 * removido — este último para o chamador revogar os object URLs, que de outra
 * forma ficam presos na memória da aba a cada exclusão.
 *
 * Id inexistente é no-op silencioso: excluir algo que já saiu não é erro, e o
 * card volta ao estado de proposta de qualquer forma.
 */
export function removerResultado<T extends ResultoRemovivel>(
  results: T[],
  artifactId: string,
): { restantes: T[]; removido: T | null } {
  const removido = results.find((r) => r.artifactId === artifactId) ?? null;
  if (!removido) return { restantes: results, removido: null };
  return {
    restantes: results.filter((r) => r.artifactId !== artifactId),
    removido,
  };
}

/**
 * A que tomo um artefato pertence, lido do sufixo do id (`capa:016:t02` → 2).
 * `0` = artefato sem tomo (volume não dividido, ou gerado antes da divisão).
 *
 * O tomo vive no id porque é o id que define a IDENTIDADE do artefato: dois
 * tomos são dois documentos, não dois estados do mesmo.
 */
export function tomoDoArtefato(artifactId: string): number {
  const m = /:t(\d{2})$/.exec(artifactId);
  return m ? Number(m[1]) : 0;
}

/**
 * Agrupa artefatos por tomo, na ordem crescente, com os sem-tomo (`0`) por
 * último.
 *
 * O grupo `0` importa: quando o engenheiro divide um volume que JÁ tinha sido
 * gerado inteiro, os artefatos antigos continuam no estado com id sem sufixo.
 * Escondê-los faria o canvas mentir; mostrá-los à parte deixa claro que sobraram
 * da divisão anterior e podem ser excluídos.
 */
export function agruparPorTomo<T extends { id: string }>(
  artefatos: T[],
): { tomo: number; itens: T[] }[] {
  const grupos = new Map<number, T[]>();
  for (const a of artefatos) {
    const t = tomoDoArtefato(a.id);
    const atual = grupos.get(t);
    if (atual) atual.push(a);
    else grupos.set(t, [a]);
  }
  return [...grupos.entries()]
    .map(([tomo, itens]) => ({ tomo, itens }))
    // Sem-tomo por último: é resto, não é o trabalho atual.
    .sort((a, b) => (a.tomo === 0 ? 1 : b.tomo === 0 ? -1 : a.tomo - b.tomo));
}
