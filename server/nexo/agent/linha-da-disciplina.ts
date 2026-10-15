/**
 * PURO, sem import: `node scripts/test-linha-da-disciplina.ts`.
 */

/**
 * A linha da disciplina nos fatos. Volume MISTO lista cada bloco com a sua
 * contagem: dizer só a mais frequente fazia o modelo afirmar que todas as
 * folhas eram dela.
 */
export function linhaDaDisciplina(resumo: { disciplina: string; blocos?: { disciplina: string; folhas: number }[] }): string {
  const blocos = resumo.blocos ?? [];
  if (blocos.length <= 1) return `- Disciplina: ${resumo.disciplina || "?"}`;
  const lista = blocos.map((b) => `${b.disciplina || "SEM DISCIPLINA"} — ${b.folhas} ${b.folhas === 1 ? "folha" : "folhas"}`).join(" · ");
  return (
    `- Disciplinas (volume MISTO): ${lista}. Cada disciplina vira um bloco no volume, ` +
    `com separatriz e LD próprias, e a capa lista todas. Ao resumir, diga quantas ` +
    `folhas são de CADA disciplina — nunca diga que todas são de uma só.`
  );
}
