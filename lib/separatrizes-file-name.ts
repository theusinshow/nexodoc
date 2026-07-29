/**
 * O nome do arquivo de separatrizes. UMA implementação, três consumidores.
 *
 * Havia três cópias desta função — a tela, a rota `/api/separatrizes/generate` e
 * a ferramenta do Nexo — e elas discordavam: duas trocavam revisão vazia pelo
 * literal "r", a terceira não. O resultado era um arquivo chamado
 * `separatrizes_r.odt`, com um sufixo pendurado que não significa nada, e um
 * mesmo pedido gerando nomes diferentes dependendo do caminho.
 *
 * A regra: cada parte entra só se existir. Revisão vazia não vira "r" — inventar
 * uma revisão que o usuário não informou é afirmar algo sobre o documento.
 */
export function buildSeparatrizesFileName(
  codigo: string,
  revisao: string,
  ext: string,
): string {
  const partes = [codigo.trim(), "separatrizes", revisao.trim()].filter(Boolean);
  return `${partes.join("_")}.${ext}`;
}
