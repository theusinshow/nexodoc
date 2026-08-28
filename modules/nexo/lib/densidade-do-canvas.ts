/**
 * QUANTO O NÓ CONTA, conforme a distância — a decisão, sem React.
 *
 * Duzentas folhas com o texto todo aceso viram sopa: o olho não varre, e varrer
 * é a razão desta tela existir. De longe o que importa é o padrão (a fileira, a
 * cor da disciplina, o buraco onde falta número); de perto, o carimbo inteiro,
 * porque ali já se está conferindo UMA folha.
 *
 * OS DOIS LIMIARES SÃO CONSTANTES NOMEADAS de propósito. Espalhados como número
 * mágico dentro do componente, ninguém acharia os dois ao mesmo tempo para
 * ajustá-los — e um limiar mexido sozinho abre uma faixa de zoom em que a
 * densidade pula duas vezes.
 *
 * A ESCALA DO CANVAS É 0,3 a 1,5 (`minZoom`/`maxZoom` em `NexoCanvas`). Os
 * limiares vivem dentro dela; fora, um dos três níveis seria inalcançável.
 *
 * PURO: roda no node cru.
 */

export type DensidadeDoNo = "longe" | "media" | "perto";

/** Abaixo disto o nó é só padrão: fio da disciplina, número e as marcas. */
export const ZOOM_LONGE = 0.55;
/** Daqui para cima cabe o carimbo inteiro — código do arquivo e disciplina por extenso. */
export const ZOOM_PERTO = 1.05;

export function densidadeDoZoom(zoom: number): DensidadeDoNo {
  if (!Number.isFinite(zoom)) return "media";
  if (zoom < ZOOM_LONGE) return "longe";
  if (zoom >= ZOOM_PERTO) return "perto";
  return "media";
}

/**
 * O QUE APARECE EM CADA NÍVEL.
 *
 * Tabela, e não uma cascata de `if` no JSX: o componente lê "posso mostrar o
 * título?" e a resposta mora aqui, onde dá para conferir os três níveis lado a
 * lado. Foi assim que ficou visível que a MARCA DE CORRIGIDO À MÃO precisa
 * sobreviver aos três — ela é o único aviso de que aquele valor veio de uma
 * pessoa, e some-la de longe faria a varredura mentir justamente sobre o que
 * não foi lido pela máquina.
 */
export interface OQueMostrar {
  /** Número da folha e total ("05/24"). */
  numero: boolean;
  /** A sigla da disciplina ao lado do número. */
  sigla: boolean;
  /** O título do desenho. */
  titulo: boolean;
  /** Código do arquivo e disciplina por extenso — o resto do carimbo. */
  carimbo: boolean;
  /** A marca de corrigido à mão e o aviso da folha sem código. */
  marcas: boolean;
}

const TABELA: Record<DensidadeDoNo, OQueMostrar> = {
  longe: {
    numero: true,
    sigla: false,
    titulo: false,
    carimbo: false,
    marcas: true,
  },
  media: {
    numero: true,
    sigla: true,
    titulo: true,
    carimbo: false,
    marcas: true,
  },
  perto: {
    numero: true,
    sigla: true,
    titulo: true,
    carimbo: true,
    marcas: true,
  },
};

export function oQueMostrar(densidade: DensidadeDoNo): OQueMostrar {
  return TABELA[densidade];
}
