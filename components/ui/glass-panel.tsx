import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

/**
 * GlassPanel — o ÚNICO lugar com `backdrop-filter` fora do backdrop de modal
 * (§6 / Apêndice H da ARQUITETURA.md). Vidro é escopado ao chrome ambiente
 * (composer dock, wash do welcome, bolha do assistente, chrome do viewer). NUNCA
 * envolva dado com ele — card/finding/Table/ConfirmationCard são sempre matte.
 *
 * O visual e as degradações (sólido sem suporte / `prefers-reduced-transparency`)
 * vivem na classe `.nexo-glass` (globals.css), FONTE ÚNICA. Aqui só compomos:
 * - `variant="weak"` → involucro sutil (bolha do assistente).
 * - `ring` → anel teal de foco/ênfase (composer dock).
 */
function GlassPanel({
  className,
  variant = "default",
  ring = false,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "weak";
  ring?: boolean;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-slot="glass-panel"
      className={cn(
        /* Uma forma so: `.nexo-glass` ja pinta fundo, backdrop-filter e o
           --glass-edge, que e `inset` e portanto sobrevive ao recorte. */
        "nexo-glass nx-cut-8",
        variant === "weak" && "nexo-glass--weak",
        ring && "nexo-glass--ring",
        className,
      )}
      {...props}
    />
  );
}

export { GlassPanel };
