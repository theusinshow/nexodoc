"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * A marca do Nexo: o Orbe do Agente, na redução ESTÁTICA em SVG (DESIGN.md §6,
 * degrau de baixo da escada de reduções).
 *
 * ERAM QUATRO VARIANTES: o nó clássico de traço, um vórtice minimalista, uma
 * esfera de vidro líquido inspirada na Siri, e esta. Três foram aposentadas
 * quando o §6 decidiu a identidade — e continuaram no arquivo por mais tempo do
 * que a decisão levou para ser tomada. Elas são o PROCESSO de escolher, e o
 * processo não pode ficar disponível para ser escolhido de novo por engano: a
 * lei manda "três degraus reais, um só objeto", e quatro desenhos diferentes do
 * logotipo é o contrário disso.
 *
 * Nenhum uso do produto passava por elas — login, sem-acesso e a barra lateral
 * sempre usaram o padrão.
 */

function ajuste(size: number) {
  if (size >= 96) {
    return { miolo: "#1a5450", meio: "#0e2a2e", fora: "#08171a", borda: 1, no: 1.6, brilho: 0.9 };
  }
  if (size >= 40) {
    return { miolo: "#23706a", meio: "#103036", fora: "#0a1f24", borda: 1.2, no: 1.9, brilho: 0.95 };
  }
  return { miolo: "#2a7a72", meio: "#12343a", fora: "#0b2126", borda: 1.6, no: 2.9, brilho: 1 };
}

const NO_24 =
  "M12 12c-1.85-2.5-3.5-3.75-4.85-3.75-1.65 0-2.7 1.55-2.7 3.75s1.05 3.75 2.7 3.75c1.35 0 3-1.25 4.85-3.75Zm0 0c1.85-2.5 3.5-3.75 4.85-3.75 1.65 0 2.7 1.55 2.7 3.75s-1.05 3.75-2.7 3.75c-1.35 0-3-1.25-4.85-3.75Z";

const NO_100 =
  "M 50 50 c -7.7 -10.4 -14.6 -15.6 -20.2 -15.6 c -6.9 0 -11.3 6.5 -11.3 15.6 s 4.4 15.6 11.3 15.6 c 5.6 0 12.5 -5.2 20.2 -15.6 Z M 50 50 c 7.7 -10.4 14.6 -15.6 20.2 -15.6 c 6.9 0 11.3 6.5 11.3 15.6 s -4.4 15.6 -11.3 15.6 c -5.6 0 -12.5 -5.2 -20.2 -15.6 Z";

export interface LogoNexoProps {
  size?: number;
  className?: string;
  /** Palavra "Nexo" ao lado do símbolo. */
  comPalavra?: boolean;
}

export function LogoNexo({
  size = 32,
  className,
  comPalavra = false,
}: LogoNexoProps) {
  const id = useId().replace(/:/g, "");
  const a = ajuste(size);

  const renderOrbStatic = () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Nexo Logo Orbe Estático"
      /*
       * A classe `.nexo-logo` saiu junto com a prop `interativa` que a ligava.
       * Ela era o gancho da animação de hover — que morava em `.nexo-logo__no`,
       * o nó da variante clássica. Esta variante nunca teve esse nó, então o
       * gancho já não pegava em nada aqui: a prop existia, os chamadores a
       * passavam, e nenhum pixel mudava.
       */
      className="shrink-0 rounded-full"
    >
      <defs>
        <clipPath id={`${id}-clip-static`}>
          <circle cx="50" cy="50" r="48" />
        </clipPath>

        {/* Fundo de vidro escura do Orbe (corpo #0c1518) */}
        <radialGradient id={`${id}-orb-bg`} cx="38%" cy="30%" r="85%">
          <stop offset="0%" stopColor="#142328" />
          <stop offset="50%" stopColor="#0c1518" />
          <stop offset="100%" stopColor="#04090b" />
        </radialGradient>

        {/* Alma interna translúcida (teal #00a693 e #5bdac6) */}
        <radialGradient id={`${id}-orb-soul`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="25%" stopColor="#eafffb" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#5bdac6" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#00a693" stopOpacity="0" />
        </radialGradient>

        {/* Luz de Aresta / Fresnel do Vidro (#5bdac6) */}
        <linearGradient id={`${id}-orb-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7af7e1" stopOpacity={a.brilho} />
          <stop offset="35%" stopColor="#5bdac6" stopOpacity="0.8" />
          <stop offset="80%" stopColor="#00a693" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#5bdac6" stopOpacity="0.6" />
        </linearGradient>

        {/* Brilho Especular Superior do Vidro Curvo */}
        <linearGradient id={`${id}-orb-specular`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Luz do Nó Nexo central */}
        <linearGradient id={`${id}-orb-node-light`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#eafffb" />
          <stop offset="100%" stopColor="#5bdac6" />
        </linearGradient>
      </defs>

      {/* Corpo de vidro escura */}
      <circle cx="50" cy="50" r="48" fill={`url(#${id}-orb-bg)`} />

      {/* Alma fluida estática do Orbe */}
      <g clipPath={`url(#${id}-clip-static)`}>
        <circle cx="50" cy="50" r="36" fill={`url(#${id}-orb-soul)`} />
      </g>

      {/* Anel de aresta / Fresnel de vidro */}
      <circle
        cx="50"
        cy="50"
        r="48"
        fill="none"
        stroke={`url(#${id}-orb-rim)`}
        strokeWidth={a.borda * 2}
      />

      {/* Reflexo especular no topo */}
      <path
        d="M 18 32 A 46 46 0 0 1 45 8 C 34 14, 22 22, 18 32 Z"
        fill={`url(#${id}-orb-specular)`}
      />
    </svg>
  );

  const simbolo = renderOrbStatic();

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

