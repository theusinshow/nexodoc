"use client";

/**
 * Nexo Core — a representação visual VIVA do agente do NexoDoc (não decoração).
 * API mínima: `state`/`activity`/`size`/`interactive`/`onActivate`. Os detalhes de
 * animação são internos. Fase 1: esfera base + idle + hover + fallback + a11y +
 * perf (DPR limitado, pausa em aba oculta, reduced-motion).
 *
 * A esfera NÃO conhece IA/API — recebe só estados abstratos. A hit-area/hover/click
 * vivem no container DOM (o Canvas é `pointerEvents:none`). Estados importantes
 * também são comunicados por texto na UI convencional — a esfera é complementar.
 */

import { useState, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";
import type { AgentOrbProps, AgentState } from "./agent-orb.types";
import {
  useReducedMotionPref,
  usePageVisible,
  useWebGLSupported,
} from "./use-agent-orb";

const SIZE_PX: Record<NonNullable<AgentOrbProps["size"]>, number> = {
  hero: 132,
  compact: 80,
};

const STATE_LABEL: Record<AgentState, string> = {
  idle: "Nexo",
  hover: "Nexo",
  dragging: "Nexo — solte os documentos aqui",
  uploading: "Nexo — enviando documentos",
  reading: "Nexo — lendo documentos",
  analyzing: "Nexo — analisando",
  responding: "Nexo — respondendo",
  complete: "Nexo — análise concluída",
  error: "Nexo — instabilidade",
};

/** Glow teal em CSS — fallback (sem WebGL) e placeholder enquanto o Canvas carrega. */
function OrbGlow() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-[16%] rounded-full"
      style={{
        background:
          "radial-gradient(circle at 40% 35%, #5bdac6 0%, #00a693 46%, color-mix(in srgb, #00a693 24%, transparent) 70%, transparent 100%)",
        boxShadow: "0 0 24px color-mix(in srgb, #00a693 40%, transparent)",
      }}
    />
  );
}

const AgentOrbCanvas = dynamic(
  () => import("./AgentOrbCanvas").then((m) => m.AgentOrbCanvas),
  { ssr: false, loading: () => <OrbGlow /> },
);

export function AgentOrb({
  state = "idle",
  activity = 0,
  size = "hero",
  interactive = true,
  onActivate,
  className,
}: AgentOrbProps) {
  const reduced = useReducedMotionPref();
  const visible = usePageVisible();
  const webgl = useWebGLSupported();
  const [hovered, setHovered] = useState(false);

  const px = SIZE_PX[size];
  // Hover só "eleva" o idle; estados de trabalho mandam sobre o hover.
  const effectiveState: AgentState =
    hovered && state === "idle" ? "hover" : state;

  const isButton = interactive && Boolean(onActivate);

  return (
    <div
      role={isButton ? "button" : "img"}
      aria-label={STATE_LABEL[effectiveState]}
      tabIndex={isButton ? 0 : undefined}
      onPointerEnter={interactive ? () => setHovered(true) : undefined}
      onPointerLeave={interactive ? () => setHovered(false) : undefined}
      onClick={isButton ? onActivate : undefined}
      onKeyDown={
        isButton
          ? (e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onActivate?.();
              }
            }
          : undefined
      }
      className={cn(
        "relative aspect-square shrink-0 select-none rounded-full outline-none",
        isButton &&
          "cursor-pointer focus-visible:ring-[3px] focus-visible:ring-ring/25",
        className,
      )}
      style={{ width: px, height: px }}
    >
      {webgl ? (
        <AgentOrbCanvas
          state={effectiveState}
          activity={activity}
          hovered={hovered}
          reduced={reduced}
          visible={visible}
        />
      ) : (
        <OrbGlow />
      )}
    </div>
  );
}
