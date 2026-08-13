/**
 * OS ACHADOS NA MARGEM DO DOCUMENTO — núcleo puro, roda em node cru.
 *
 * O visor abria a página de UM achado e calava sobre o resto: com onze achados
 * no mesmo memorial, conferir era voltar ao parecer, clicar no próximo, ler a
 * página, voltar. A margem é onde o documento diz quantos problemas tem e onde
 * eles estão — é o padrão de revisão que todo mundo já conhece, e ele existe
 * porque funciona.
 *
 * DUAS REGRAS DO PRODUTO governam este arquivo:
 *
 * 1. **Ausência nunca vira conflito.** Achado sem página provável NÃO vira pin.
 *    Ele existe, está no parecer, e a margem simplesmente não sabe onde pô-lo —
 *    inventar uma posição seria afirmar um fato que ninguém apurou.
 *
 * 2. **Só o documento aberto.** Um parecer cruza memorial, pranchas e LD. Pin
 *    de achado de outro documento na margem deste apontaria para uma página que
 *    não é a dele.
 */

/** O que a margem precisa saber de um achado. */
export interface AchadoPosicionavel {
  /** Chave estável do achado — `refId` quando existe, senão o índice. */
  chave: string;
  /** Texto do campo "Página provável", como veio do parecer. */
  pagina?: string;
  /** URL do documento a que este achado se refere; ausente = sem documento. */
  pdfUrl?: string;
  severity: "critical" | "warning" | "ok";
  title: string;
}

/** Um marcador na régua. */
export interface PinDoParecer {
  chave: string;
  page: number;
  /** Posição vertical na régua, 0 (topo) a 1 (fim). */
  top: number;
  severity: "critical" | "warning" | "ok";
  title: string;
}

/** O primeiro número de "página provável" ("12", "12-14", "p. 12"). */
export function primeiraPagina(valor?: string): number | null {
  const m = valor?.match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Os pins do documento aberto, ordenados por página.
 *
 * `numPages` vem do próprio PDF já carregado. Sem ele (0), não há régua: a
 * posição de um pin é uma FRAÇÃO do documento, e sem saber o tamanho não se
 * pode dizer que a página 12 está no meio ou no fim.
 */
export function pinsDoDocumento(
  achados: readonly AchadoPosicionavel[],
  urlAberta: string,
  numPages: number,
): PinDoParecer[] {
  if (!urlAberta || numPages <= 0) return [];

  const pins: PinDoParecer[] = [];
  for (const a of achados) {
    if (a.pdfUrl !== urlAberta) continue;
    const page = primeiraPagina(a.pagina);
    if (page === null || page > numPages) continue;
    pins.push({
      chave: a.chave,
      page,
      /*
       * O CENTRO da faixa da página, não o topo dela.
       *
       * Com `(page - 1) / numPages` o pin da página 1 encosta na borda de cima
       * e o da última sobra meia faixa embaixo — a régua fica torta em relação
       * ao documento que representa. O centro distribui parelho.
       */
      top: (page - 0.5) / numPages,
      severity: a.severity,
      title: a.title,
    });
  }

  /*
   * Ordem de PÁGINA, não a do parecer. A régua é o documento, e o documento
   * tem uma ordem só — a de leitura. O parecer ordena por gravidade, que é a
   * ordem de decidir; aqui, misturar as duas faria a navegação por margem pular
   * para trás sem motivo visível.
   */
  return pins.sort((a, b) => a.page - b.page);
}
