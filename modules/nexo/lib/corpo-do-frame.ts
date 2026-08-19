/**
 * O TAMANHO DO TEXTO no frame do documento, por MODO.
 *
 * Núcleo puro (sem imports) → `node scripts/test-corpo-do-frame.ts`.
 *
 * A função morava dentro do `FrameDoDocumento` e tinha um problema que o
 * próprio cabeçalho do componente denunciava sem perceber. Ele promete:
 *
 *   "Não é pré-visualização fiel (fonte e brasão são do ODT); é a ESTRUTURA"
 *
 * e mesmo assim importava o corpo da fonte do ODT para dentro da interface —
 * 16pt virava `text-sm`, e o rodapé de 8pt virava `text-[11px]`. O resultado é
 * uma folha A4 encolhida numa coluna de 520px, com campos que o cursor não
 * acerta. Era esse o "muito pequeno".
 *
 * Agora há dois modos, e a diferença entre eles é SÓ esta função:
 *
 *   campo       o frame é um formulário com a FORMA do documento. A ordem, o
 *               alinhamento e o número de linhas continuam vindo do modelo; o
 *               tamanho do texto passa a ser o da interface.
 *   documento   a coluna alargou e o ponto é ver como sai. O corpo do ODT volta
 *               a mandar — mas nunca abaixo do piso da escala, porque fiel é o
 *               TEXTO, não o direito de sumir da tela.
 */

export type ModoDoFrame = "campo" | "documento";

/**
 * Degraus nomeados da `DESIGN.md`. Nenhum tamanho solto: a rampa existe "para
 * que nenhuma tela invente um tamanho fora da escala".
 */
const CAPTION = "text-xs"; // 12px
const CORPO = "text-sm"; // 14px
const SUBTITLE = "text-base font-medium"; // 16px
const TITLE = "text-lg font-medium"; // 18px

export function classeDeCorpo(corpo: number | undefined, modo: ModoDoFrame): string {
  if (modo === "campo") {
    /*
     * UM tamanho para tudo. O documento tem hierarquia de CORPO; o formulário
     * tem hierarquia de POSIÇÃO — e ela já vem do modelo, no alinhamento e na
     * ordem dos parágrafos. Repetir a hierarquia do papel aqui só devolveria o
     * problema que este modo existe para resolver.
     */
    return CORPO;
  }

  if (!corpo) return CAPTION;
  if (corpo >= 18) return TITLE;
  if (corpo >= 15) return SUBTITLE;
  if (corpo >= 12) return CORPO;
  /*
   * O PISO. Abaixo de 12pt o documento continua diminuindo e a interface não:
   * "microrrótulos podem cair a 11px, nunca abaixo". Um rodapé de 8pt fiel ao
   * milímetro seria ilegível na tela e impossível de editar — e este modo
   * existe justamente para CONFERIR.
   */
  return CAPTION;
}
