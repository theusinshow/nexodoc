/**
 * A DECISÃO DE ABERTURA DA CONVERSA — extraída de `selectConversation`
 * (conversation-store.tsx) na revisão final da segunda rodada, 15/09/2026 (I5).
 *
 * Três revisões da c3 mexeram nesta decisão, e ela vivia dentro do provider, sem
 * teste puro. Aqui ficam só as REGRAS; as esperas (commit, fila, lista do
 * servidor, disco, rede) e as escritas continuam no store, na mesma ordem.
 * Tabela-verdade em `scripts/test-abertura-da-conversa.ts`.
 *
 * PURO e sem imports: roda no node cru.
 */

/**
 * A marca de recusa guardada no localStorage depois de um 409 do servidor:
 * "descer" (quem gravou foi outra máquina: a cópia do servidor tem de pousar no
 * disco) ou "manter" (409 com base não conferida: pode ter sido falso, e o disco
 * tem edições que não existem em lugar nenhum).
 */
export type MarcaDeRecusa = "descer" | "manter";

/** O que aconteceu com a cópia do servidor nesta abertura; `null` = nem foi lida. */
export type CopiaDoServidor = "desceu" | "ausente" | "falhou" | null;

/**
 * DE ONDE ABRIR, e se a base nasce verificada.
 *
 * - Recarregar depois do 409 do servidor (`travadaNaMemoria`) ou com a marca
 *   "descer": quem gravou foi OUTRA MÁQUINA, e o disco desta tem a versão desta
 *   aba — com hora que pode ser mais nova que a de lá. O desempate por data
 *   escolheria justamente a desatualizada: lê do servidor primeiro.
 * - Marca "manter" sem a trava na memória (F5, outra aba): abre do DISCO, e só
 *   vai ao servidor se o disco não tiver nada. A base não está conferida. Só
 *   "Recarregar a conversa", com a trava na memória desta aba, troca pela do
 *   servidor.
 * - Sem marca: disco preferido, e o desempate é a data (`servidorMaisNovo`,
 *   de `escolherCopia`).
 * - `verificada` nasce de a lista do servidor ter chegado: sem ela a base abre
 *   "não conferida", e um 409 não desce nada por cima do disco.
 */
export function decidirAbertura(args: {
  travadaNaMemoria: boolean;
  marca: MarcaDeRecusa | null;
  /**
   * A trava da memória veio de um 409 com a base NÃO conferida (a fila sabe,
   * mesmo sem a marca). Revisão da frente A, 15/09/2026.
   */
  travaSemConferir?: boolean;
  /** A pessoa pediu pela faixa para trocar pela cópia do servidor (e confirmou, se precisava). */
  recargaConfirmada?: boolean;
  listaCarregada: boolean;
  temDisco: boolean;
  servidorMaisNovo: boolean;
}): {
  manterDisco: boolean;
  lerDoServidorPrimeiro: boolean;
  irAoServidor: boolean;
  verificada: boolean;
} {
  /*
   * TRAVA SEM CONFERIR, REABERTA SEM A FAIXA (revisão da frente A, 15/09/2026):
   * clicar de novo na conversa, ou sair e voltar, lia do servidor primeiro e a
   * cópia dele pousava no disco sem a confirmação que a faixa pede — as edições
   * só desta máquina sumiam logo depois de "Continuar travada". Sem a recarga
   * confirmada, é o caminho da marca "manter": disco, travada.
   */
  const semConferirSemConfirmacao =
    args.travadaNaMemoria && args.travaSemConferir === true && args.recargaConfirmada !== true;
  const manterDisco =
    (args.marca === "manter" && !args.travadaNaMemoria) || semConferirSemConfirmacao;
  const lerDoServidorPrimeiro =
    !semConferirSemConfirmacao && (args.travadaNaMemoria || args.marca === "descer");
  const irAoServidor = manterDisco
    ? !args.temDisco
    : lerDoServidorPrimeiro || args.servidorMaisNovo;
  const verificada = manterDisco ? false : args.listaCarregada;
  return { manterDisco, lerDoServidorPrimeiro, irAoServidor, verificada };
}

/**
 * O RESULTADO DA LEITURA NO SERVIDOR.
 *
 * - achada: a base fica verificada; se a cópia desceu ao disco, a marca some
 *   (senão toda reabertura pagaria a rede de novo e um F5 offline a perderia).
 * - ausente: apagada no servidor (noutra máquina) — a marca não trava para sempre.
 * - falhou: o servidor é mais novo e não deu para ler: a base não está conferida.
 */
export function depoisDoServidor(args: {
  verificada: boolean;
  consulta: "achada" | "ausente" | "falhou";
  /** Só conta com `achada`: a cópia do servidor pousou no disco. */
  desceu: boolean;
}): { verificada: boolean; copiaDoServidor: CopiaDoServidor; esquecerMarca: boolean } {
  if (args.consulta === "achada") {
    return {
      verificada: true,
      copiaDoServidor: args.desceu ? "desceu" : "falhou",
      esquecerMarca: args.desceu,
    };
  }
  if (args.consulta === "ausente") {
    return { verificada: args.verificada, copiaDoServidor: "ausente", esquecerMarca: true };
  }
  return { verificada: false, copiaDoServidor: "falhou", esquecerMarca: false };
}

/**
 * ABRE TRAVADA?
 *
 * Recusada pelo servidor e sem conseguir a cópia dele (rede fora): o que abriu
 * é a cópia parada do disco. Abre travada, com a faixa — gravar dali apagaria o
 * trabalho da outra máquina, porque a hora parada é mais nova. Com a marca
 * "manter", abre do disco e travada de propósito. Conversa que o servidor não
 * tem mais ("ausente") abre destravada.
 */
export function abreTravada(args: {
  lerDoServidorPrimeiro: boolean;
  manterDisco: boolean;
  copiaDoServidor: CopiaDoServidor;
}): boolean {
  return (
    (args.lerDoServidorPrimeiro &&
      args.copiaDoServidor !== "desceu" &&
      args.copiaDoServidor !== "ausente") ||
    (args.manterDisco && args.copiaDoServidor === null)
  );
}
