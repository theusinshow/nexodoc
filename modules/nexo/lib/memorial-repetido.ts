/**
 * O MESMO MEMORIAL SOLTO DE NOVO.
 *
 * Até 15/09/2026, soltar outra vez o memorial que a conversa já tinha criava um
 * segundo chip, relia o documento e gravava de novo "Anexei o memorial" e "Li as
 * primeiras páginas" — duas rodadas idênticas no histórico (jornada c1). As
 * pranchas já não duplicavam: a regra é por nome, e o Matheus decidiu que o
 * memorial segue a mesma.
 *
 * Nome EXATO, e não por conteúdo: é o que a tela mostra no chip, e renomear o
 * arquivo é o gesto de quem quer que ele conte como outro.
 *
 * PURO e sem imports: roda no node cru.
 */
export function separarMemorialRepetido<T extends { name: string }>(
  pdfs: readonly T[],
  nomeDoMemorialRetido: string | null,
): { novos: T[]; repetido: string | null } {
  if (!nomeDoMemorialRetido) return { novos: [...pdfs], repetido: null };
  const novos = pdfs.filter((f) => f.name !== nomeDoMemorialRetido);
  return { novos, repetido: novos.length < pdfs.length ? nomeDoMemorialRetido : null };
}
