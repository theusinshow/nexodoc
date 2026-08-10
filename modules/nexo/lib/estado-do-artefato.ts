/**
 * EM QUE ESTADO ESTÁ UM ARTEFATO JÁ GERADO.
 *
 * Morava dentro do ConfirmationCard, onde só os cards individuais a
 * alcançavam. O plano em lote — o caminho NORMAL de gerar — ficou sem ela e
 * passou a dizer "Gerado" para documento envelhecido. Aqui ela é de todos.
 */

/** Os três estados de um artefato no card (§ "Estados das ações do Nexo"). */
export type EstadoArtefato = "proposta" | "pendente" | "aplicado";

/**
 * Compara os params que o engenheiro acabou de pedir com os que ORIGINARAM o
 * resultado já gerado.
 *
 * Existe porque o id do artefato é estável de propósito (uma capa por conversa,
 * atualizada no lugar). Sem esta comparação o card via "já existe resultado" e
 * só oferecia o download — pedir "muda para o volume 6" mostrava o PDF do volume
 * I como se estivesse em dia.
 *
 * Resultado antigo sem params guardados (gerado antes disto existir): não dá
 * para provar que está em dia, então tratamos como PENDENTE — melhor oferecer
 * um "gerar de novo" desnecessário do que esconder uma alteração pedida.
 *
 * A comparação é LITERAL, por JSON. Quem monta o payload precisa montá-lo
 * sempre da mesma forma, ou o artefato nasce eternamente pendente — é por isso
 * que existe `payloadDoItem` em `editar-artefato.ts`, uma função só, usada por
 * quem grava e por quem compara.
 */
export function estadoDoArtefato(
  saved: { payload?: unknown } | undefined,
  params: unknown,
): EstadoArtefato {
  if (!saved) return "proposta";
  if (saved.payload === undefined) return "pendente";
  return JSON.stringify(saved.payload) === JSON.stringify(params)
    ? "aplicado"
    : "pendente";
}
