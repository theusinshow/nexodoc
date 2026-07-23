"use client";

/**
 * QuickReplyChips (§3 da ARQUITETURA.md) — pré-respostas da IA, renderizadas
 * ABAIXO da bolha, NUNCA como formulário. Cada chip é uma ação conversacional:
 *
 * - `fill`  → escreve o valor no composer, foca e seleciona. O usuário edita e
 *             dá Enter. Fica "no caminho certo" sem digitar do zero. NUNCA gera.
 * - `send`  → envia direto (fluxo: "Sim, pode gerar" / "Agora não").
 *
 * A 1ª sugestão é a recomendada (variante `suggest`), mas NUNCA é auto-commitada
 * — é sempre um clique explícito. `fill` e `send` se distinguem por ícone e por
 * aria-label (a11y). Revela uma vez no mount (`.nexodoc-enter`).
 */

import { Pencil, CornerDownLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import type { NexoSlotSuggestion } from "../types";
import { useComposer } from "../state/composer-controller";

export function QuickReplyChips({
  suggestions,
  className,
}: {
  suggestions: NexoSlotSuggestion[];
  className?: string;
}) {
  const composer = useComposer();

  if (suggestions.length === 0) return null;

  return (
    <div className={cn("nexodoc-enter flex flex-wrap gap-1.5", className)}>
      {suggestions.map((s, i) => {
        const isFill = s.commit === "fill";
        return (
          <Chip
            key={`${s.value}-${i}`}
            variant={i === 0 ? "suggest" : "default"}
            aria-label={
              isFill
                ? `Preencher no campo de mensagem: ${s.label}`
                : `Enviar: ${s.label}`
            }
            onClick={() => (isFill ? composer.fill(s.value) : composer.send(s.value))}
          >
            {isFill ? <Pencil aria-hidden /> : <CornerDownLeft aria-hidden />}
            {s.label}
          </Chip>
        );
      })}
    </div>
  );
}
