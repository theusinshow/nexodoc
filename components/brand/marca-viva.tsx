"use client";

/**
 * A MARCA DO NEXODOC — o quadro capturado do orbe vivo (DESIGN.md §6).
 *
 * Substitui o `LogoNexo` (SVG desenhado à mão) nas telas do produto. A troca
 * fecha uma discordância que estava em toda parte: o produto mostrava o orbe e
 * a aba do navegador mostrava outra coisa.
 *
 * ELA VOLTA A VIVER NO HOVER, e isso não é enfeite: a marca é um instante
 * congelado de uma coisa viva, então o ponteiro descongela. São 18 quadros
 * consecutivos numa tira PNG trocados por `steps()` — sem WebGL, sem three.js.
 *
 * DUAS DISCIPLINAS, as duas no CSS (`globals.css`, seção da marca):
 *
 *  1. **Nada vive ao lado do orbe vivo.** Enquanto houver um `AgentOrb` montado,
 *     ele marca `data-orbes-vivos` no `<html>` e a animação daqui se cala. Sem
 *     isso, a barra lateral e o painel — que convivem com o orbe 3D — teriam
 *     duas coisas em movimento na mesma tela.
 *  2. **Movimento reduzido não recebe movimento nenhum.**
 *
 * A TIRA SÓ BAIXA NO PRIMEIRO HOVER. São 216 KB, e cobrá-los de toda visita
 * para um efeito que a maioria nunca dispara seria caro pelo motivo errado. Até
 * lá — e sempre, por baixo — o que se vê é o PNG estático.
 */

import { useState } from "react";

import { cn } from "@/lib/utils";

export interface MarcaVivaProps {
  /** Lado em pixels. O arquivo servido é escolhido a partir daqui. */
  size?: number;
  className?: string;
  /** A palavra "Nexo" ao lado do símbolo. */
  comPalavra?: boolean;
  /**
   * Desliga o hover mesmo sem orbe vivo na tela. Para onde a marca é enfeite de
   * cabeçalho e o movimento não acrescenta nada.
   */
  parada?: boolean;
}

/**
 * Qual arquivo servir. Não existe "o maior serve para tudo": um PNG de 512
 * reduzido a 20px pelo navegador fica mole, e o de 32 esticado a 180 fica
 * quebrado. A escada segue a mesma lógica do `ajuste()` do SVG antigo.
 */
function arquivoPara(size: number): string {
  if (size >= 181) return "/marca/orbe-512.png";
  if (size >= 65) return "/marca/orbe-180.png";
  if (size >= 33) return "/marca/orbe-64.png";
  return "/marca/orbe-32.png";
}

export function MarcaViva({
  size = 32,
  className,
  comPalavra = false,
  parada = false,
}: MarcaVivaProps) {
  const [acordada, setAcordada] = useState(false);

  function acorda() {
    if (!parada) setAcordada(true);
  }

  const simbolo = (
    <span
      className={cn("nx-marca", parada && "nx-marca--parada")}
      data-acordada={acordada || undefined}
      style={{
        width: size,
        height: size,
        // O estático é sempre a camada de baixo: se a tira ainda não chegou (ou
        // nunca for pedida), a marca continua inteira na tela.
        ["--nx-marca-estatica" as string]: `url("${arquivoPara(size)}")`,
        ...(acordada ? { ["--nx-marca-tira" as string]: 'url("/marca/orbe-tira.png")' } : {}),
      }}
      onPointerEnter={acorda}
      onFocus={acorda}
      role="img"
      aria-label="NexoDoc"
    />
  );

  if (!comPalavra) {
    return <span className={className}>{simbolo}</span>;
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {simbolo}
      <span
        className="font-semibold tracking-[-0.035em]"
        style={{ fontSize: Math.round(size * 0.72) }}
      >
        Nexo
      </span>
    </span>
  );
}
