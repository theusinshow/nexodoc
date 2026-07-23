"use client";

/**
 * NexoOrb — peça central do welcome, mini-indicador no header depois (§6).
 *
 * v1 = SIMPLES (decisão do Apêndice H): glow radial teal→luminous em CSS, sem o
 * sistema de partículas/pó (esse é enhancement pós-v1, com R3F). Iridescência só
 * teal→luminous→neutro — nunca rust/roxo/neon. `thinking` reusa o
 * `nexodoc-status-pulse` já existente (respira). `reduced-motion` congela num
 * estado-final legível (o reset global zera a animação, mas o gradiente
 * permanece visível — nunca some).
 */

import { cn } from "@/lib/utils";

export type NexoOrbState = "idle" | "thinking" | "responding";

export function NexoOrb({
  state = "idle",
  className,
}: {
  state?: NexoOrbState;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={
        state === "thinking"
          ? "Nexo pensando"
          : state === "responding"
            ? "Nexo respondendo"
            : "Nexo"
      }
      data-state={state}
      className={cn(
        "relative inline-block aspect-square rounded-full",
        state === "thinking" && "nexodoc-status-pulse",
        className,
      )}
      style={{
        // Núcleo luminoso (--ring) → teal (--primary) → transparente. O glow
        // externo dá o "vidro que emite luz" sem shader.
        background:
          "radial-gradient(circle at 35% 30%, var(--ring) 0%, var(--primary) 42%, color-mix(in srgb, var(--primary) 30%, transparent) 70%, transparent 100%)",
        boxShadow:
          "0 0 24px color-mix(in srgb, var(--primary) 45%, transparent), 0 0 48px color-mix(in srgb, var(--ring) 20%, transparent)",
      }}
    />
  );
}
