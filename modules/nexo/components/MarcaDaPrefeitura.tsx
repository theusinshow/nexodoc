/**
 * A MARCA DE PREFEITURA na tela — três segmentos, quatro tamanhos, uma regra.
 *
 * A regra que decide as cores é pura e mora em [[marca-da-prefeitura.ts]];
 * aqui só se desenha. A separação importa porque o casamento do município (que
 * é onde se erra) é testável em node cru, e o desenho não precisa ser.
 *
 * NÃO TEM CHANFRO PRÓPRIO. Onde a marca entra num cartão, o recorte é o do
 * `nx-edge-*` que já envolve o cartão inteiro — dois chanfros aninhados no
 * mesmo canto brigam, e o de dentro sempre perde.
 *
 * `aria-hidden`, SEMPRE. A marca é redundante por construção: em toda tela em
 * que ela aparece, o nome da prefeitura está escrito a poucos pixels dela. Um
 * rótulo de leitor de tela repetiria "Criciúma" duas vezes por linha, e quem
 * ouve a lista pagaria por uma cor que não vê.
 */

import { cn } from "@/lib/utils";
import {
  coresDaPrefeitura,
  GEOMETRIA_DA_MARCA,
  prefeituraConhecida,
  type FormaDaMarca,
} from "../lib/marca-da-prefeitura";

export function MarcaDaPrefeitura({
  prefeitura,
  forma,
  className,
}: {
  /**
   * O que a tela tem em mãos: a pasta (`084-25-CRICIUMA`), o campo CLIENTE do
   * carimbo, ou o município cru. O casamento aceita as três formas.
   */
  prefeitura: string | null | undefined;
  forma: FormaDaMarca;
  className?: string;
}) {
  const g = GEOMETRIA_DA_MARCA[forma];
  const cores = coresDaPrefeitura(prefeitura);

  return (
    <span
      aria-hidden
      data-marca-de-prefeitura={forma}
      className={cn(
        "flex shrink-0",
        g.empilhado ? "flex-col" : "flex-row",
        /*
         * CINZA A 50%, e não `hidden`. A prefeitura desconhecida ocupa o mesmo
         * espaço que a conhecida: some, e a linha sem prefeitura fica mais
         * curta que a vizinha — que é exatamente a diferença que a marca
         * existe para NÃO fazer com uma cidade.
         */
        !prefeituraConhecida(prefeitura) && "opacity-50",
        className,
      )}
      style={{ gap: `${g.gap}px` }}
    >
      {cores.map((cor, i) => (
        <span
          key={i}
          style={{ width: `${g.largura}px`, height: `${g.altura}px`, background: cor }}
        />
      ))}
    </span>
  );
}
