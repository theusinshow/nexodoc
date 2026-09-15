/**
 * ONDE GRAVAR O PARECER QUE ACABOU DE CHEGAR.
 *
 * A auditoria leva minutos, e o engenheiro troca de conversa nesse meio-tempo.
 * O cartão gravava o resultado na conversa aberta NO INSTANTE DA CHEGADA: em
 * 15/09/2026 a jornada c5 pôs o parecer de A dentro de B, e limpou o bilhete de B
 * no lugar do de A. As correções da janela de troca (`agenda-de-gravacao.ts`)
 * não alcançam isto: aquela corrida dura milissegundos; esta dura a auditoria.
 *
 * Aberta outra conversa, nada é gravado e o bilhete de A FICA: ao reabrir A,
 * `useReconectarAuditoria` pergunta ao servidor e grava o parecer nela — o mesmo
 * caminho do F5, sem uma segunda via de gravação.
 *
 * PURO e sem imports: roda no node cru.
 */
export function desfechoNaChegada(args: {
  origem: string;
  aberta: string;
  desconectou: boolean;
}): { gravarParecer: boolean; limparBilhete: boolean } {
  const naOrigem = args.origem !== "" && args.origem === args.aberta;
  const cicloFechadoAqui = naOrigem && !args.desconectou;
  return { gravarParecer: cicloFechadoAqui, limparBilhete: cicloFechadoAqui };
}
