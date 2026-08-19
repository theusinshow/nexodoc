/**
 * A COORDENADA DO PDF EM 0..1 — e por que ela mora sozinha.
 *
 * Esta conversão vivia dentro de `modules/nexo/lib/selo-render.ts`, que é
 * `"use client"` porque usa o canvas do browser. A bancada de medição precisa
 * rodar o MESMO leitor que a produção roda, e não pode importar um módulo
 * client-only.
 *
 * Reimplementá-la do lado da bancada mediria uma CÓPIA do leitor. Um número
 * sobre uma cópia é pior que número nenhum: ele dá confiança sobre código que
 * não é o que roda — e a confiança sobrevive à divergência, porque ninguém
 * volta a conferir um número que já saiu verde.
 *
 * PURO (só `import type`): sem DOM, sem pdfjs, sem alias `@/`. Isso é o que o
 * deixa rodar em node cru, no script de medição.
 */
import type { ItemPosicionado } from "../server/nexo/selo-regiao.ts";

/** Um item já convertido para o espaço do viewport, antes de normalizar. */
export interface PontoNoViewport {
  texto: string;
  /** x em pixels do viewport, origem no canto superior esquerdo. */
  x: number;
  /** y em pixels do viewport, crescendo para BAIXO. */
  y: number;
}

/**
 * Divide pelo tamanho da página.
 *
 * Página degenerada (largura ou altura zero, que é como o pdf.js entrega uma
 * página que falhou ao abrir) devolve lista VAZIA em vez de `Infinity`
 * espalhado por todas as coordenadas. Sem âncora, `acharCaixaDoSelo` já cai no
 * quadrante de reserva — que é o comportamento certo. Deixar `Infinity`/`NaN`
 * viajar faria as comparações de caixa devolverem `false` em silêncio, e o
 * sintoma apareceria três camadas adiante como "o selo veio vazio".
 */
export function normalizarItens(
  brutos: readonly PontoNoViewport[],
  pagina: { largura: number; altura: number },
): ItemPosicionado[] {
  if (!(pagina.largura > 0) || !(pagina.altura > 0)) return [];
  return brutos.map((b) => ({
    texto: b.texto,
    x: b.x / pagina.largura,
    y: b.y / pagina.altura,
  }));
}
