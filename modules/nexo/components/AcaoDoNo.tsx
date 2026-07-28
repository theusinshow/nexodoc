"use client";

/**
 * A ação de um nó do canvas. UM vocabulário para os dois tipos de nó: o de folha
 * (Abrir, Corrigir) e o de documento (Alterar no chat, Editar aqui, Excluir).
 *
 * Existe porque cada nó vinha inventando o seu botão — tamanhos, cores e pesos
 * diferentes para ações do mesmo nível —, e o usuário não conseguia dizer o que
 * cada coisa fazia. DESIGN.md §5: mesma forma de botão, mesmo ícone, mesmo gap.
 *
 * Ícone SEMPRE com rótulo visível (§5, Iconography): ícone sozinho só é permitido
 * para glifos universais. A explicação do que a ação faz vai no tooltip, não no
 * rótulo — rótulo curto para caber no nó, tooltip para tirar a dúvida.
 */

import type { ComponentType } from "react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AcaoDoNo({
  icone: Icone,
  rotulo,
  ajuda,
  onClick,
  desabilitado = false,
  tom = "normal",
}: {
  icone: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  rotulo: string;
  /** O que a ação faz, em uma frase. Vira o tooltip. */
  ajuda: string;
  onClick: () => void;
  desabilitado?: boolean;
  /** `perigo` = ação destrutiva (excluir). */
  tom?: "normal" | "perigo";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={desabilitado}
          className={cn(
            // `nodrag nopan`: sem isso o React Flow sequestra o clique e o botão
            // vira alça de arrasto do nó.
            "nodrag nopan inline-flex min-h-6 items-center gap-1 rounded-sm px-1 font-mono text-[10px]",
            "transition-colors duration-150 ease-out outline-none",
            "focus-visible:ring-[3px] focus-visible:ring-ring/25",
            "disabled:cursor-not-allowed disabled:opacity-40",
            tom === "perigo"
              ? "text-muted-foreground hover:text-destructive disabled:hover:text-muted-foreground"
              : "text-muted-foreground hover:text-primary disabled:hover:text-muted-foreground",
          )}
        >
          <Icone className="size-3 shrink-0" aria-hidden />
          {rotulo}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{ajuda}</TooltipContent>
    </Tooltip>
  );
}
