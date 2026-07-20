import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps extends React.ComponentProps<"div"> {
  /** Rotulo curto (Mono Label) nomeando a regiao. */
  label: string;
  /** Uma linha de corpo explicando o que aparece aqui e como. */
  description?: string;
  /** Icone opcional, pequeno e muted (lucide). Nunca uma ilustracao grande. */
  icon?: LucideIcon;
  /** Acao primaria opcional (ex.: um <Button>). */
  action?: React.ReactNode;
}

/**
 * EmptyState: ensina a interface, nunca so "nada aqui" (DESIGN.md, secao
 * Empty States). Ocupa a area de conteudo com calma, dentro do vocabulario
 * de superficie existente — sem ilustracao grande, sem emoji, sem tom de
 * marketing. Estado neutro; uma falha usa o vocabulario de Signal Critical,
 * nao este tratamento.
 */
function EmptyState({
  label,
  description,
  icon: Icon,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {Icon && (
        <Icon
          className="size-5 text-muted-foreground"
          strokeWidth={1.5}
          aria-hidden
        />
      )}
      <p className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-foreground">
        {label}
      </p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export { EmptyState };
