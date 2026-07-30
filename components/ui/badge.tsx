import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  /*
   * Mono Label de verdade: 11px, caixa alta, +0.05em. Era 12px em caixa mista,
   * que é o estilo de DADO — e badge não é dado, é rótulo. A caixa alta também
   * separa o badge do texto ao redor sem precisar de peso ou cor.
   */
  "inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2 font-mono text-[11px] font-medium uppercase leading-none tracking-[0.05em] transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary/8 text-primary",
        secondary:
          "border-border bg-secondary text-secondary-foreground",
        outline: "border-border bg-background/35 text-foreground",
        // Vocabulario de status unico do sistema. Consolida o padrao
        // border/30 + bg-tint + text que estava repetido inline em ~16 telas.
        ok: "border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)] text-[var(--status-ok)]",
        warning:
          "border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
        critical:
          "border-[var(--status-critical)]/30 bg-[var(--status-critical-bg)] text-[var(--status-critical)]",
        /*
         * INFORMAÇÃO não é status: explica o estado do software sem pedir ação
         * (retomada pós-F5, sem permissão, contexto do sistema). Existe porque
         * tudo isso saía em âmbar por falta de opção — e quando "seu documento
         * está velho" divide a cor com "reconectei sozinho", o engenheiro
         * aprende a ignorar o âmbar, e o aviso que custa dinheiro passa batido.
         */
        info: "border-[var(--signal-info-border)] bg-[var(--signal-info-bg)] text-[var(--signal-info)]",
        /* LEGADO: funciona e não é o caminho novo. Nem status, nem desabilitado. */
        legacy:
          "border-[var(--legacy-border)] bg-[var(--legacy-bg)] text-[var(--legacy)]",
        /* ÊNFASE (rust): marca sem julgar — valor ausente, modo profundo, o que
           veio da mão de uma pessoa. Nunca status. */
        emphasis:
          "border-[var(--nexodoc-tertiary-strong)]/32 bg-[var(--nexodoc-tertiary-bg)] text-[var(--nexodoc-tertiary)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
