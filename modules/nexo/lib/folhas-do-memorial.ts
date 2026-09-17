/**
 * UM DOCUMENTO NÃO É MEMORIAL E PRANCHA AO MESMO TEMPO.
 *
 * 17/09/2026, Urubici. O memorial 031_26 foi lido como prancha (a recusa por
 * tamanho era engolida — ver [[limite-do-anexo.ts]]) e a conversa ficou com 206
 * folhas de carimbo DELE. Consertada a leitura, anexá-lo de novo trazia a
 * identidade certa, mas as folhas velhas continuavam ali: o cartão anunciava
 * "obra lida do carimbo das pranchas — fonte independente do memorial" sobre o
 * próprio memorial, e a conversa mostrava "1 folha de selo lida — pronto para
 * gerar" ao lado de "Memorial anexado".
 *
 * A limpeza já existia no caminho da correção à mão (`definirPapelAnexo`), que
 * tira o arquivo do conjunto de pranchas e descarta os selos dele. Faltava no
 * caminho NORMAL do anexo, que é por onde quase todo mundo passa.
 *
 * Compara por NOME porque é o que o selo guarda (`SeloResult.fileName`), e é o
 * mesmo critério da correção à mão.
 *
 * PURO.
 */

export function semAsFolhasDoArquivo<T extends { fileName: string }>(
  folhas: readonly T[],
  nomeDoMemorial: string,
): T[] {
  return folhas.filter((f) => f.fileName !== nomeDoMemorial);
}

/** Quantas folhas seriam descartadas — a conversa diz o que apagou. */
export function folhasDoArquivo(
  folhas: readonly { fileName: string }[],
  nomeDoMemorial: string,
): number {
  return folhas.filter((f) => f.fileName === nomeDoMemorial).length;
}
