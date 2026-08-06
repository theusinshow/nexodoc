/**
 * AS DECISÕES do engenheiro sobre o documento — título, volume, data, divisão
 * em tomos, prefeitura.
 *
 * Diferente da IDENTIDADE ([[identidade.ts]]), que o agente nunca propõe: estes
 * campos ELE propõe a cada turno, e por isso precisam de uma regra de quem
 * vence. Sem ela, editar o título no frame e mandar outra mensagem no chat
 * desfaria a edição em silêncio — a terceira encarnação de "correção aceita e
 * revertida sem aviso" neste projeto.
 *
 * A regra, em uma frase: cada decisão guarda O VALOR DO AGENTE QUE ELA
 * SUBSTITUIU. No turno seguinte, se o agente mudou de ideia ele vence; se
 * repetiu o mesmo valor, a decisão fica.
 *
 * Isso resolve os dois casos que uma regra simples erraria: "a decisão sempre
 * vence" impediria pedir "muda o título para X" pelo chat; "o agente sempre
 * vence" apagaria a edição do frame.
 *
 * PURO: nenhum import, para rodar em `node scripts/test-nexo-decisoes.ts`.
 */

export interface Decisao {
  /** O que o engenheiro pôs. */
  valor: string;
  /** O que o agente propunha quando esta decisão foi tomada. */
  sobre: string;
}

export type DecisoesDoProjeto = Record<string, Decisao>;

/** Os campos que o frame decide. A identidade NÃO entra aqui. */
export const CAMPOS_DECIDIVEIS = [
  "templateId",
  "tituloCapa",
  "tituloLd",
  "volume",
  "mes",
  "ano",
  "numTomos",
  "tomoInicial",
] as const;

/**
 * Registra uma decisão. Valor vazio APAGA — é como se desfaz, igual à
 * identidade. Decidir exatamente o que o agente já propôs também não é
 * decisão: guardá-la só criaria ruído para a mescla resolver depois.
 */
export function anotarDecisao(
  atuais: DecisoesDoProjeto,
  campo: string,
  valor: string,
  propostoPeloAgente: string,
): DecisoesDoProjeto {
  const proxima = { ...atuais };
  const limpo = valor.trim();
  if (!limpo || limpo === propostoPeloAgente.trim()) {
    delete proxima[campo];
    return proxima;
  }
  proxima[campo] = { valor: limpo, sobre: propostoPeloAgente.trim() };
  return proxima;
}

/**
 * Os valores que valem agora, e as decisões que sobrevivem ao turno.
 *
 * Quem chama deve GUARDAR `vivas` de volta: uma decisão que perdeu para o
 * agente e continuasse guardada voltaria a vencer no turno seguinte, quando o
 * agente repetisse o valor novo.
 */
export function mesclarDecisoes(
  decisoes: DecisoesDoProjeto,
  paramsDoAgente: Record<string, string>,
): { valores: Record<string, string>; vivas: DecisoesDoProjeto } {
  const valores: Record<string, string> = { ...paramsDoAgente };
  const vivas: DecisoesDoProjeto = {};

  for (const [campo, decisao] of Object.entries(decisoes)) {
    const agora = (paramsDoAgente[campo] ?? "").trim();
    const mudouDeIdeia = agora !== "" && agora !== decisao.sobre;
    if (mudouDeIdeia) continue; // o agente vence; a decisão cai
    valores[campo] = decisao.valor;
    vivas[campo] = decisao;
  }
  return { valores, vivas };
}
