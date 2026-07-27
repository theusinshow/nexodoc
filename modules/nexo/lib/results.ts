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
