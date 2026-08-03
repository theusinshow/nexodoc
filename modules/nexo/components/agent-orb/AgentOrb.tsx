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

/**
 * O tamanho do orbe.
 *
 * HERO é FLUIDO, e não um número fixo: na tela de boas-vindas ele é o único
 * objeto e precisa ancorar a composição, mas num notebook de 768px de altura um
 * disco grande empurrava a saudação e o composer para baixo. `clamp` resolve os
 * dois, e a conta é sobre a ALTURA da janela porque é a altura que falta, nunca
 * a largura.
 *
 * COMPACT continua fixo: ali ele divide a coluna com o chat, e um tamanho que
 * variasse com a janela mexeria na altura útil da conversa a cada resize.
 *
 * Os números cresceram 1,157× quando a câmera recuou (ver `AgentOrbCanvas`): a
 * caixa é maior, a ESFERA aparece do mesmo tamanho, e o que antes era cortado
 * pela borda — satélites e anéis — agora tem folga para existir.
 */
const SIZE_CSS: Record<NonNullable<AgentOrbProps["size"]>, string> = {
  hero: "clamp(194px, 24vh, 268px)",
  compact: "172px",
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
  fileCount = 0,
  size = "hero",
  interactive = true,
  onActivate,
  className,
}: AgentOrbProps) {
  const reduced = useReducedMotionPref();
  const visible = usePageVisible();
  const webgl = useWebGLSupported();
  const [hovered, setHovered] = useState(false);
  // O toque é ESTADO de interação, não de agente: mora aqui, não no enum.
  const [pressed, setPressed] = useState(false);

  const px = SIZE_CSS[size];
  // Hover é uma reação FÍSICA amortecida (boost no Scene via `hovered`), não uma
  // troca de estado — evita aplicar o realce em dobro. Estados de trabalho mandam.
  const isButton = interactive && Boolean(onActivate);

  return (
    <div
      role={isButton ? "button" : "img"}
      aria-label={STATE_LABEL[state]}
      tabIndex={isButton ? 0 : undefined}
      onPointerEnter={interactive ? () => setHovered(true) : undefined}
      onPointerLeave={
        interactive
          ? () => {
              setHovered(false);
              // Sair com o botão apertado não pode deixar o orbe afundado.
              setPressed(false);
            }
          : undefined
      }
      onPointerDown={isButton ? () => setPressed(true) : undefined}
      onPointerUp={isButton ? () => setPressed(false) : undefined}
      onPointerCancel={isButton ? () => setPressed(false) : undefined}
      onClick={isButton ? onActivate : undefined}
      onKeyDown={
        isButton
          ? (e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                // O teclado também merece o reconhecimento do toque: sem isto,
                // quem navega por Tab abre o cartão sem a esfera reagir.
                setPressed(true);
                setTimeout(() => setPressed(false), 140);
                onActivate?.();
              }
            }
          : undefined
      }
      className={cn(
        // `nexo-agent-orb` anima o resize hero↔compact (persistência de layout).
        "nexo-agent-orb relative aspect-square shrink-0 select-none rounded-full outline-none",
        isButton &&
          "cursor-pointer focus-visible:ring-[3px] focus-visible:ring-ring/25",
        className,
      )}
      style={{ width: px, height: px }}
    >
      {webgl ? (
        <AgentOrbCanvas
          state={state}
          activity={activity}
          fileCount={fileCount}
          hovered={hovered}
          pressed={pressed}
          reduced={reduced}
          visible={visible}
        />
      ) : (
        <OrbGlow />
      )}
    </div>
  );
}
