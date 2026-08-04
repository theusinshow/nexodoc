/**
 * Geometria da auditoria visual: onde cai cada página, cada card de achado e o
 * bloco dos achados sem página.
 *
 * Cada página é um GRUPO: a miniatura em cima, os cards dos seus achados
 * empilhados logo abaixo. Assim a linha card↔página é curta e não cruza o
 * desenho — com os cards numa coluna à parte, um memorial de 30 achados vira uma
 * teia que ninguém lê. A linha da grade tem a altura do seu grupo mais alto.
 *
 * PURO: só importa a raiz das colunas — roda em node pelado
 * (`scripts/test-nexo-audit-layout.ts`).
 */
// Com extensão: este módulo roda em node cru no teste, e lá o especificador
// precisa ser completo.
import { colunasDaGrade } from "./layout-canvas.ts";

export const LARGURA_PAGINA = 200;
/** Miniatura 3/4 (200×267) + rodapé com o número da página + bordas. */
export const ALTURA_PAGINA = 305;
export const ALTURA_CARTAO = 72;
/** Altura do card + respiro entre cards. */
export const PASSO_CARTAO = 80;
/** Respiro entre a página e o primeiro card dela. */
export const FOLGA_CARTAO = 12;
/** Respiro entre grupos, na horizontal e na vertical. */
export const FOLGA = 40;

export interface PosicaoNoCanvas {
  x: number;
  y: number;
}

export interface EntradaDoLayout {
  /** Páginas com achado, na ordem em que devem aparecer. */
  paginas: { pageNumber: number; findingIds: string[] }[];
  /** Ids dos achados sem página localizada. */
  semPagina: string[];
}

export interface LayoutDaAuditoria {
  paginas: Record<number, PosicaoNoCanvas>;
  achados: Record<string, PosicaoNoCanvas>;
  /** Canto superior esquerdo do bloco "sem página" (null se não houver). */
  topoSemPagina: PosicaoNoCanvas | null;
  colunas: number;
  altura: number;
}

/** Altura de um grupo: a página mais os cards dos seus achados. */
function alturaDoGrupo(quantosAchados: number): number {
  if (quantosAchados === 0) return ALTURA_PAGINA;
  return ALTURA_PAGINA + FOLGA_CARTAO + quantosAchados * PASSO_CARTAO - (PASSO_CARTAO - ALTURA_CARTAO);
}

export function layoutDaAuditoria(entrada: EntradaDoLayout): LayoutDaAuditoria {
  const { paginas, semPagina } = entrada;
  const colunas = colunasDaGrade(paginas.length);

  // Altura de cada LINHA da grade = o grupo mais alto dela. Sem isto, um grupo
  // com 5 achados escreve por cima da linha de baixo.
  const alturasDasLinhas: number[] = [];
  paginas.forEach((pagina, i) => {
    const linha = Math.floor(i / colunas);
    const altura = alturaDoGrupo(pagina.findingIds.length);
    alturasDasLinhas[linha] = Math.max(alturasDasLinhas[linha] ?? 0, altura);
  });

  const topoDaLinha: number[] = [];
  let cursor = 0;
  for (const altura of alturasDasLinhas) {
    topoDaLinha.push(cursor);
    cursor += altura + FOLGA;
  }

  const posPaginas: Record<number, PosicaoNoCanvas> = {};
  const posAchados: Record<string, PosicaoNoCanvas> = {};

  paginas.forEach((pagina, i) => {
    const x = (i % colunas) * (LARGURA_PAGINA + FOLGA);
    const y = topoDaLinha[Math.floor(i / colunas)];
    posPaginas[pagina.pageNumber] = { x, y };
    pagina.findingIds.forEach((id, k) => {
      posAchados[id] = { x, y: y + ALTURA_PAGINA + FOLGA_CARTAO + k * PASSO_CARTAO };
    });
  });

  // Os sem página não somem: viram um bloco próprio abaixo de tudo, na mesma
  // grade (uma coluna só viraria torre num memorial com muitos deles).
  let topoSemPagina: PosicaoNoCanvas | null = null;
  if (semPagina.length > 0) {
    const y = cursor;
    topoSemPagina = { x: 0, y };
    semPagina.forEach((id, k) => {
      posAchados[id] = {
        x: (k % colunas) * (LARGURA_PAGINA + FOLGA),
        y: y + Math.floor(k / colunas) * PASSO_CARTAO,
      };
    });
    cursor = y + Math.ceil(semPagina.length / colunas) * PASSO_CARTAO;
  }

  return {
    paginas: posPaginas,
    achados: posAchados,
    topoSemPagina,
    colunas,
    altura: cursor,
  };
}
