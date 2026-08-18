/**
 * QUAL CÓPIA DA CONVERSA ABRIR.
 *
 * SEM IMPORTS de runtime (nem alias `@/`): roda no node cru do
 * `test:copia-mais-nova`.
 *
 * A abertura escolhia por PRESENÇA — `getConversation` e, só se não houvesse
 * nada, o servidor. O disco continua sendo preferido, e por uma razão que não
 * mudou: é ele que tem os BYTES dos artefatos, e trocar por uma cópia sem
 * arquivo em nome de "fonte da verdade" seria uma perda disfarçada de correção.
 *
 * O que muda é o DESEMPATE, que passa a ser a data. É o critério que a listagem
 * (`fundirListas`) já usava e que o comentário da própria abertura declarava ser
 * o certo — "é resolvida na lista, por `updatedAt`, não aqui". Enquanto a
 * abertura escolhia por presença, uma gravação de disco que falhasse deixava ali
 * uma versão velha que eclipsava a cópia boa do servidor, para sempre.
 */

type ComData = { updatedAt: number };

export function escolherCopia(
  disco: ComData | null,
  remoto: ComData | null,
): "disco" | "servidor" | "nenhuma" {
  if (!disco && !remoto) return "nenhuma";
  if (!disco) return "servidor";
  if (!remoto) return "disco";
  /*
   * Empate resolve para o DISCO, como em `fundirListas`: é o que a pessoa tem
   * na frente, e é onde moram os bytes. Duas regras de desempate diferentes
   * para o mesmo dado fariam a lista e a abertura discordarem.
   */
  return remoto.updatedAt > disco.updatedAt ? "servidor" : "disco";
}
