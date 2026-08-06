"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * A marca do Nexo: o orbe do agente, ESTÁTICO — esfera de vidro escura com o nó
 * aceso dentro.
 *
 * Era desenho de linha: um círculo e um nó em traço de 1,5px. Lia como ícone de
 * interface, não como o objeto que o palco mostra. Agora tem corpo, luz de
 * aresta e um nó que brilha — a mesma leitura do orbe vivo, parada.
 *
 * SVG INLINE, não `<img>`: o miolo de uma imagem externa é inalcançável por CSS,
 * e a marca precisa reagir ao mouse. O nó gira devagar no hover, na direção e no
 * ritmo do estado `idle` do orbe vivo, para as duas leituras serem reconhecidas
 * como o MESMO objeto. Em repouso fica parada — marca que se mexe sozinha vira
 * decoração, e o único autorizado a respirar aqui é o orbe do palco, que está
 * dizendo o que o agente faz.
 *
 * ## O ajuste por tamanho, que é o problema de verdade
 *
 * A §6 avisa: "reproduzir o brilho do orbe 3D em tamanho pequeno vira mancha".
 * Uma esfera escura sobre fundo escuro PERDE A SILHUETA aos 16px — o favicon
 * some. A saída não é desenhar outra marca (duas marcas não são uma reduzida):
 * é o MESMO desenho com o contraste rebalanceado conforme encolhe.
 *
 * Quanto menor, mais o corpo clareia e mais o nó pesa: aos 16px quem carrega a
 * leitura é o nó e o anel, não o volume do vidro — que naquele tamanho ninguém
 * enxerga de todo jeito.
 */

/**
 * Como a esfera se comporta em cada faixa de tamanho.
 *
 * O bordo NUNCA chega ao preto do fundo da aplicação (`#0a0e11`): uma esfera
 * escura sobre fundo escuro perde a silhueta e o que sobra é o desenho de linha
 * que esta marca veio substituir. Aconteceu aos 48px no /login, com a faixa
 * "grande" começando cedo demais — vidro profundo só se lê quando a marca é
 * mesmo grande, de herói.
 */
function ajuste(size: number) {
  if (size >= 96) {
    // Herói: há área suficiente para o vidro ter profundidade de verdade.
    return { miolo: "#1a5450", meio: "#0e2a2e", fora: "#08171a", borda: 1, no: 1.6, brilho: 0.9 };
  }
  if (size >= 40) {
    return { miolo: "#23706a", meio: "#103036", fora: "#0a1f24", borda: 1.2, no: 1.9, brilho: 0.95 };
  }
  // Favicon e ícones inline: o vidro não se lê, então o nó e o anel assumem.
  return { miolo: "#2a7a72", meio: "#12343a", fora: "#0b2126", borda: 1.6, no: 2.9, brilho: 1 };
}

const NO =
  "M12 12c-1.85-2.5-3.5-3.75-4.85-3.75-1.65 0-2.7 1.55-2.7 3.75s1.05 3.75 2.7 3.75c1.35 0 3-1.25 4.85-3.75Zm0 0c1.85-2.5 3.5-3.75 4.85-3.75 1.65 0 2.7 1.55 2.7 3.75s-1.05 3.75-2.7 3.75c-1.35 0-3-1.25-4.85-3.75Z";

export function LogoNexo({
  size = 32,
  className,
  /** Palavra "Nexo" ao lado do símbolo. */
  comPalavra = false,
  /** Liga o giro no hover. Desligue onde a marca não é interativa. */
  interativa = true,
}: {
  size?: number;
  className?: string;
  comPalavra?: boolean;
  interativa?: boolean;
}) {
  /*
   * Os gradientes precisam de id ÚNICO por instância: dois logos na mesma
   * página com o mesmo id fazem o segundo herdar o primeiro, e um deles some
   * quando o outro desmonta.
   */
  const id = useId().replace(/:/g, "");
  const a = ajuste(size);

  const simbolo = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Nexo"
      className={cn("shrink-0", interativa && "nexo-logo")}
    >
      <defs>
        {/* O volume do vidro: claro em cima à esquerda, fundo no bordo. */}
        <radialGradient id={`${id}-corpo`} cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor={a.miolo} />
          <stop offset="55%" stopColor={a.meio} />
          <stop offset="100%" stopColor={a.fora} />
        </radialGradient>
        {/* A luz de aresta: forte no topo, quase nada na cintura, de volta em
            baixo — é o que faz a superfície parecer curva e não um disco. */}
        <linearGradient id={`${id}-aresta`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7af7e1" stopOpacity={a.brilho} />
          <stop offset="42%" stopColor="#00a693" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#00a693" stopOpacity="0.42" />
        </linearGradient>
        <linearGradient id={`${id}-no`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7af7e1" />
          <stop offset="100%" stopColor="#00a693" />
        </linearGradient>
      </defs>

      <circle cx="12" cy="12" r="11" fill={`url(#${id}-corpo)`} />
      <circle
        cx="12"
        cy="12"
        r="11"
        fill="none"
        stroke={`url(#${id}-aresta)`}
        strokeWidth={a.borda}
      />
      {/* O nó é o que gira no hover; a esfera fica parada. */}
      <path
        className="nexo-logo__no"
        d={NO}
        fill="none"
        stroke={`url(#${id}-no)`}
        strokeWidth={a.no}
        strokeLinecap="round"
      />
    </svg>
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
