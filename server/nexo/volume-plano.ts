/**
 * A EXPECTATIVA POR PÁGINA do volume montado — núcleo puro.
 *
 * A montagem sabe o que vai gerar: `buildVolumeParts` produz as partes na ordem
 * canônica, e `assembleVolume` diz quantas páginas cada uma contribuiu. O que
 * faltava era transformar isso na pergunta que a conferência precisa fazer:
 *
 *   a página 9 do PDF final deveria ser O QUÊ?
 *
 * Sem essa tabela, conferir o volume montado seria comparar o documento com uma
 * intuição. Com ela, cada página tem um gabarito, e discordar do gabarito é um
 * achado com página e nome.
 *
 * PURO: sem imports, para rodar em node cru no `scripts/test-nexo-volume-check.ts`.
 * Por isso `PapelDaPagina` é redeclarado em vez de importado de `volume-parts.ts`.
 */

/** Espelha `VolumePartRole` de `volume-parts.ts`. Redeclarado: núcleo puro. */
export type PapelDaPagina = "capa" | "separatriz" | "ld" | "prancha";

/**
 * Quantas páginas uma parte contribui para o volume.
 *
 * A faixa `startPage`/`endPage` é 1-based e INCLUSIVA, e pode mentir: ela é
 * derivada dos selos, e o selo é lido de um carimbo. Uma faixa que estoura o
 * documento ou que começa antes da primeira página não pode virar contagem
 * negativa nem inflada — `buildRowPdf` copia só o que existe, e a conta aqui tem
 * de bater com o que ele realmente copiou. Se não bater, a conferência inteira
 * acusa um deslocamento que não existe.
 */
export function paginasDaParte(
  totalDoDocumento: number,
  startPage?: number,
  endPage?: number,
): number {
  if (!Number.isFinite(totalDoDocumento) || totalDoDocumento <= 0) return 0;
  const inicio = Math.max(1, Math.trunc(startPage ?? 1));
  const fim = Math.min(totalDoDocumento, Math.trunc(endPage ?? totalDoDocumento));
  return Math.max(0, fim - inicio + 1);
}
