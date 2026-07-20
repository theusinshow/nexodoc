import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton: reserva o layout do conteudo que vai chegar (DESIGN.md, secao
 * Loading & Skeletons). Fundo recessed (`--muted`), raio unico do sistema e
 * uma varredura sutil e lenta — nunca um pulse. Dimensione com className
 * (`h-4 w-32`, etc.) no formato do elemento que vai substituir.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        className,
      )}
      {...props}
    >
      <div className="skeleton-shimmer absolute inset-0" />
    </div>
  );
}

export { Skeleton };
