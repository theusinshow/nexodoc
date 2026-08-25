/**
 * As duas decisões da rota que dão para testar sem subir servidor.
 *
 * Ficam fora do `route.ts` porque o Next só aceita handlers exportados de lá —
 * e sem elas aqui o contrato SSE só seria conferido no navegador, tarde demais.
 */
import type { ItemDeSaida } from "../../../../server/audit/chat/run-chat-turn.ts";

/**
 * Um evento SSE.
 *
 * `JSON.stringify` escapa a quebra de linha, e é isso que impede o corte: um
 * delta com "\n\n" cru dentro partiria o evento em dois, e o cliente leria
 * metade da frase como um evento sem `type`.
 */
export function linhaSse(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * O que o laço precisa da resposta do runner.
 *
 * `text` vem vazio quando a volta só trouxe chamada de ferramenta — e isso NÃO
 * é erro: `extractOutputText` só lança em resposta incompleta ou recusada.
 */
export function respostaDoModelo(ai: { text: string; response: unknown }): {
  text: string;
  output: ItemDeSaida[];
} {
  const bruto = ai.response as { output?: ItemDeSaida[]; output_text?: string };
  return {
    text: ai.text || (bruto.output_text ?? "").trim(),
    output: bruto.output ?? [],
  };
}
