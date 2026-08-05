/**
 * COMO UM TEXTO DA CAPA VIRA LINHAS IMPRESSAS.
 *
 * A capa tem dois campos que saem em várias linhas — o nome da obra e o título
 * (as disciplinas) — e a regra de onde quebrar precisava existir em UM lugar:
 * o gerador a aplicava só no título, e o frame do editor precisa mostrar ao
 * engenheiro o mesmo resultado que vai sair impresso. Duas cópias da regra é
 * como o que se vê na tela volta a discordar do PDF.
 *
 * Duas fontes de quebra, nesta ordem:
 *
 * 1. o ENTER que a pessoa digitou. Manda sempre — se ela arrumou as linhas à
 *    mão, nada mais opina;
 * 2. o " - " do carimbo, quando não há Enter nenhum. O selo escreve
 *    "REFORMA E AMPLIAÇÃO - EMEB RUBENS DE ARRUDA RAMOS" numa linha só porque a
 *    célula do carimbo é uma linha só; na capa isso são duas, e sempre foram.
 *    Só o PRIMEIRO " - " quebra: o segundo costuma ser parte do nome.
 *
 * PURO: nenhum import de runtime — roda em node cru e é lido também pelo
 * cliente, que desenha o frame da capa.
 */

/** As linhas em que `valor` sai impresso. Vazio → lista vazia. */
export function linhasDaCapa(valor: string | undefined): string[] {
  const texto = (valor ?? "").trim();
  if (!texto) return [];

  const digitadas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  // A pessoa já disse onde quebra: o " - " não tem mais o que decidir.
  if (digitadas.length > 1) return digitadas;

  const unica = digitadas[0] ?? "";
  const corte = unica.search(/\s[-–]\s/);
  if (corte < 0) return [unica];
  return [
    unica.slice(0, corte).trim(),
    unica.slice(corte).replace(/^\s[-–]\s/, "").trim(),
  ].filter(Boolean);
}

/** O mesmo, já unido por "\n" — a forma que o gerador de ODT consome. */
export function textoEmLinhasDaCapa(valor: string | undefined): string {
  return linhasDaCapa(valor).join("\n");
}
