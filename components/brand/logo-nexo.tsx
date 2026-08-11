"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * A marca do Nexo: o Orbe do Agente.
 *
 * Suporta a variante clássica de traço ("node") e a variante de vidro líquido
 * iridescente inspirada na esfera 3D da Siri ("fluid-siri"), combinando a leitura
 * de profundidade de vidro escura, ondas luminosas internas e o nó icônico do Nexo.
 *
 * Pode ser estático ou animado continuamente via prop `animated={true}` ou no hover.
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
  /** Liga a reatividade no hover. */
  interativa?: boolean;
  /** Liga o motion contínuo de ondas internas. */
  animated?: boolean;
  /** Estilo do logotipo: "orb-static" (o próprio Orbe do Agente estático), "minimal-vortex" (vórtice minimalista), "fluid-siri" (vidro 3D com luzes) ou "node" (nó clássico). */
  variant?: "orb-static" | "minimal-vortex" | "fluid-siri" | "node";
}

export function LogoNexo({
  size = 32,
  className,
  comPalavra = false,
  interativa = true,
  animated = false,
  variant = "orb-static",
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
      className={cn(
        "shrink-0 rounded-full",
        interativa && "nexo-logo",
      )}
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

  const renderMinimalVortex = () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Nexo Logo Minimal Vortex"
      className={cn(
        "shrink-0 rounded-full",
        interativa && "nexo-logo",
        animated && "nexo-logo--animated",
      )}
    >
      <defs>
        <clipPath id={`${id}-clip-min`}>
          <circle cx="50" cy="50" r="48" />
        </clipPath>

        {/* Fundo suave escuro ou transparente dependendo da utilização */}
        <radialGradient id={`${id}-min-bg`} cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="#0c1d1a" />
          <stop offset="60%" stopColor="#061214" />
          <stop offset="100%" stopColor="#02080a" />
        </radialGradient>

        <linearGradient id={`${id}-blade-grad-1`} x1="0.1" y1="0.1" x2="0.9" y2="0.9">
          <stop offset="0%" stopColor="#7af7e1" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#5bdac6" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#00a693" stopOpacity="0.75" />
        </linearGradient>

        <linearGradient id={`${id}-blade-grad-2`} x1="0.9" y1="0.1" x2="0.1" y2="0.9">
          <stop offset="0%" stopColor="#bff3ea" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#5bdac6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#00a693" stopOpacity="0.7" />
        </linearGradient>

        <radialGradient id={`${id}-center-pinch`} cx="50%" cy="50%" r="45%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="30%" stopColor="#eafffb" stopOpacity="0.9" />
          <stop offset="70%" stopColor="#5bdac6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#00a693" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={`${id}-rim-light`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7af7e1" stopOpacity={a.brilho} />
          <stop offset="50%" stopColor="#5bdac6" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#00a693" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Círculo base de vidro translúcido limpo */}
      <circle cx="50" cy="50" r="48" fill={`url(#${id}-min-bg)`} />

      {/* Tri-Vórtice Minimalista (3 lâminas orgânicas em simetria de 120°) */}
      <g clipPath={`url(#${id}-clip-min)`} className="nexo-logo__vortex-tri">
        <path
          d="M 50 4 A 46 46 0 0 1 90 73 C 74 62, 58 54, 50 50 C 45 42, 38 22, 50 4 Z"
          fill={`url(#${id}-blade-grad-1)`}
        />
        <path
          d="M 90 73 A 46 46 0 0 1 10 73 C 14 55, 34 46, 50 50 C 58 45, 78 38, 90 73 Z"
          fill={`url(#${id}-blade-grad-2)`}
        />
        <path
          d="M 10 73 A 46 46 0 0 1 50 4 C 62 18, 58 38, 50 50 C 42 58, 22 78, 10 73 Z"
          fill={`url(#${id}-blade-grad-1)`}
        />

        {/* Ponto central luminoso de pinch onde as 3 lâminas cruzam */}
        <circle cx="50" cy="50" r="16" fill={`url(#${id}-center-pinch)`} />
        <circle cx="50" cy="50" r="4" fill="#ffffff" className="nexo-logo__core" />
      </g>

      {/* Anel externo limpo de contorno */}
      <circle
        cx="50"
        cy="50"
        r="48"
        fill="none"
        stroke={`url(#${id}-rim-light)`}
        strokeWidth={a.borda * 1.8}
      />
    </svg>
  );

  const simbolo =
    variant === "orb-static"
      ? renderOrbStatic()
      : variant === "minimal-vortex"
      ? renderMinimalVortex()
      : variant === "fluid-siri" ? (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Nexo Logo Orbe Siri"
      className={cn(
        "shrink-0 rounded-full",
        interativa && "nexo-logo",
        animated && "nexo-logo--animated",
      )}
    >
      <defs>
        {/* Mascara circular perfeita da esfera de vidro */}
        <clipPath id={`${id}-clip`}>
          <circle cx="50" cy="50" r="48" />
        </clipPath>

        {/* Fundo de vidro translúcido escuro (fidelidade com a captura) */}
        <radialGradient id={`${id}-glass-bg`} cx="40%" cy="35%" r="80%">
          <stop offset="0%" stopColor="#081e1b" />
          <stop offset="55%" stopColor="#041214" />
          <stop offset="100%" stopColor="#010608" />
        </radialGradient>

        {/* Gradientes dos 3 braços fluídos (teal/ciano iridescente) */}
        <linearGradient id={`${id}-arm-1`} x1="0.2" y1="0.2" x2="0.5" y2="0.5">
          <stop offset="0%" stopColor="#5bdac6" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#00a693" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#7af7e1" stopOpacity="0.9" />
        </linearGradient>

        <linearGradient id={`${id}-arm-2`} x1="0.8" y1="0.2" x2="0.5" y2="0.5">
          <stop offset="0%" stopColor="#7af7e1" stopOpacity="0.8" />
          <stop offset="70%" stopColor="#00a693" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#5bdac6" stopOpacity="0.85" />
        </linearGradient>

        <linearGradient id={`${id}-arm-3`} x1="0.5" y1="0.8" x2="0.5" y2="0.5">
          <stop offset="0%" stopColor="#00a693" stopOpacity="0.75" />
          <stop offset="50%" stopColor="#5bdac6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#eafffb" stopOpacity="0.9" />
        </linearGradient>

        {/* Linha de scan técnico horizontal */}
        <linearGradient id={`${id}-scan-line`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5bdac6" stopOpacity="0" />
          <stop offset="20%" stopColor="#5bdac6" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#7af7e1" stopOpacity="0.7" />
          <stop offset="80%" stopColor="#5bdac6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#5bdac6" stopOpacity="0" />
        </linearGradient>

        {/* Estrela de iluminação central (flare de pinch) */}
        <radialGradient id={`${id}-pinch-flare`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="30%" stopColor="#eafffb" stopOpacity="0.85" />
          <stop offset="65%" stopColor="#5bdac6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#00a693" stopOpacity="0" />
        </radialGradient>

        {/* Aro reflexivo / Fresnel teal vibrante da borda */}
        <linearGradient id={`${id}-aresta`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7af7e1" stopOpacity={a.brilho} />
          <stop offset="30%" stopColor="#5bdac6" stopOpacity="0.8" />
          <stop offset="70%" stopColor="#00a693" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#5bdac6" stopOpacity="0.7" />
        </linearGradient>

        {/* Brilho especular curvado superior esquerdo */}
        <linearGradient id={`${id}-top-specular`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <linearGradient id={`${id}-node-light`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#eafffb" />
          <stop offset="100%" stopColor="#5bdac6" />
        </linearGradient>
      </defs>

      {/* Esfera base de vidro escuro */}
      <circle cx="50" cy="50" r="48" fill={`url(#${id}-glass-bg)`} />

      {/* Conteúdo interior — 3 braços de vortex + linha de scan + pinch flare */}
      <g clipPath={`url(#${id}-clip)`}>
        {/* Linha de varredura/scan horizontal */}
        <rect
          x="4"
          y="48.5"
          width="92"
          height="3"
          fill={`url(#${id}-scan-line)`}
          className="nexo-logo__scan-line"
        />

        {/* Tri-vortex: 3 braços fluídos principais (fidelidade idêntica à imagem) */}
        <g className="nexo-logo__vortex-tri">
          {/* Braço 1: Superior Esquerdo */}
          <path
            d="M 26 18 C 30 32, 40 44, 50 50 C 42 54, 22 44, 18 30 Z"
            fill={`url(#${id}-arm-1)`}
            className="nexo-logo__arm-1"
          />
          {/* Braço 2: Superior Direito */}
          <path
            d="M 74 24 C 66 36, 56 44, 50 50 C 58 54, 76 46, 80 32 Z"
            fill={`url(#${id}-arm-2)`}
            className="nexo-logo__arm-2"
          />
          {/* Braço 3: Inferior Central */}
          <path
            d="M 44 82 C 45 66, 47 56, 50 50 C 54 56, 60 74, 54 84 Z"
            fill={`url(#${id}-arm-3)`}
            className="nexo-logo__arm-3"
          />
        </g>

        {/* Flare de estrela no ponto de encontro dos 3 braços (Pinch Core) */}
        <circle cx="50" cy="50" r="18" fill={`url(#${id}-pinch-flare)`} />
        <path
          d="M 50 40 C 50 47, 47 50, 40 50 C 47 50, 50 53, 50 60 C 50 53, 53 50, 60 50 C 53 50, 50 47, 50 40 Z"
          fill="#ffffff"
          opacity="0.9"
          className="nexo-logo__star-pinch"
        />
      </g>

      {/* Anel de aresta de vidro com brilho ciano/teal intenso */}
      <circle
        cx="50"
        cy="50"
        r="48"
        fill="none"
        stroke={`url(#${id}-aresta)`}
        strokeWidth={a.borda * 2}
      />

      {/* Brilho especular curvado no canto superior esquerdo (exato como na imagem) */}
      <path
        d="M 18 32 A 46 46 0 0 1 45 8 C 34 14, 22 22, 18 32 Z"
        fill={`url(#${id}-top-specular)`}
      />
    </svg>
  ) : (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Nexo Logo Node"
      className={cn(
        "shrink-0",
        interativa && "nexo-logo",
        animated && "nexo-logo--animated",
      )}
    >
      <defs>
        <radialGradient id={`${id}-corpo`} cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor={a.miolo} />
          <stop offset="55%" stopColor={a.meio} />
          <stop offset="100%" stopColor={a.fora} />
        </radialGradient>
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
      <path
        className="nexo-logo__no"
        d={NO_24}
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

