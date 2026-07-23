"use client";

/**
 * Canvas R3F do Nexo Core — carregado dynamic ssr:false (WebGL precisa do DOM).
 * `pointerEvents:none`: a hit-area/hover/click ficam no container DOM (o brief pede
 * não capturar eventos indevidamente). `frameloop` pausa em aba oculta e vira
 * `demand` em reduced-motion (perf). DPR limitado.
 */

import { Canvas } from "@react-three/fiber";

import { AgentOrbScene } from "./AgentOrbScene";
import type { AgentState } from "./agent-orb.types";

export function AgentOrbCanvas({
  state,
  activity,
  fileCount,
  hovered,
  reduced,
  visible,
}: {
  state: AgentState;
  activity: number;
  fileCount: number;
  hovered: boolean;
  reduced: boolean;
  visible: boolean;
}) {
  const frameloop = reduced ? "demand" : visible ? "always" : "never";
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={frameloop}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 3.2], fov: 42 }}
      style={{ width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <AgentOrbScene
        state={state}
        activity={activity}
        fileCount={fileCount}
        hovered={hovered}
        reduced={reduced}
      />
    </Canvas>
  );
}
