/**
 * QUÃO ALTO AVISAR quando uma gravação falha.
 *
 * SEM IMPORTS de runtime (nem alias `@/`): roda no node cru do
 * `test:aviso-gravacao`.
 *
 * O projeto já pagou caro pelo modo de falhar silencioso. `nexo-sync.ts` abre
 * declarando a doutrina — *"o modo de falhar que esse projeto já pagou caro é o
 * silencioso: parece que salvou"* — e `putConversation` a violava na linha
 * seguinte ao comentário que a chamava de "a gravação que vale no instante".
 *
 * Mas gritar em TODA falha é o defeito oposto. A maioria delas não põe trabalho
 * nenhum em risco, porque a outra cópia gravou; e aviso que aparece à toa é
 * aviso que se aprende a ignorar. Daí a graduação: o alarme fica reservado para
 * quando o próximo clique pode custar o trabalho.
 */

export type NivelDoAviso = "nenhum" | "so-disco" | "so-servidor" | "grave";

export function avisoDeGravacao(
  disco: "ok" | "falhou",
  servidor: "ok" | "desligada" | "expurgada" | "falhou",
): NivelDoAviso {
  /*
   * EXPURGADA NÃO É PERDA — é uma ordem cumprida.
   *
   * O servidor recusou a gravação porque um administrador apagou esta conversa
   * pelo painel, e o cliente está apagando a cópia local em seguida. Avisar
   * "não foi possível salvar" aqui mandaria a pessoa tentar recuperar um
   * trabalho que alguém decidiu apagar — e, pior, sugeriria que insistir
   * resolveria, quando insistir é exatamente o que o 410 impede.
   *
   * Vale mesmo com o disco falhando: não há o que proteger numa conversa que
   * está saindo dos dois lados.
   */
  if (servidor === "expurgada") return "nenhum";

  if (disco === "ok") {
    // O trabalho está nesta máquina. Só o servidor falhando é o aviso âmbar que
    // a barra lateral já mostrava: "salvo aqui, não no servidor".
    return servidor === "falhou" ? "so-disco" : "nenhum";
  }
  /*
   * O disco falhou. O servidor só é rede de segurança quando de fato GRAVOU:
   * "desligada" significa que ele nunca grava, então o trabalho está apenas na
   * aba aberta — e fechá-la o perde. É o caso da instalação sem banco, e é o
   * mais perigoso justamente por parecer o funcionamento normal.
   */
  return servidor === "ok" ? "so-servidor" : "grave";
}
