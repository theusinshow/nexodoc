import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  /*
   * Mono Label de verdade: 11px, caixa alta, +0.05em. Era 12px em caixa mista,
   * que é o estilo de DADO — e badge não é dado, é rótulo. A caixa alta também
   * separa o badge do texto ao redor sem precisar de peso ou cor.
   *
   * O badge NÃO usa a camada de contorno do sistema: as variantes tinham fundo
   * E borda TRANSLÚCIDOS, e numa camada o miolo comporia sobre a cor da borda
   * em vez de sobre a página — toda variante de status mudaria de cor. Uma
   * forma só, chanfro de 5px, sem contorno. É o que a spec já mandava.
   */
  "nx-cut-5 inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border-0 px-2 font-mono text-[11px] font-medium uppercase leading-none tracking-[0.05em] transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/8 text-primary",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "bg-background/35 text-foreground",
        // Vocabulario de status unico do sistema. Consolida o padrao
        // border/30 + bg-tint + text que estava repetido inline em ~16 telas.
        ok: "bg-[var(--status-ok-bg)] text-[var(--status-ok)]",
        warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
        critical: "bg-[var(--status-critical-bg)] text-[var(--status-critical)]",
        /*
         * INFORMAÇÃO não é status: explica o estado do software sem pedir ação
         * (retomada pós-F5, sem permissão, contexto do sistema). Existe porque
         * tudo isso saía em âmbar por falta de opção — e quando "seu documento
         * está velho" divide a cor com "reconectei sozinho", o engenheiro
         * aprende a ignorar o âmbar, e o aviso que custa dinheiro passa batido.
         */
        info: "bg-[var(--signal-info-bg)] text-[var(--signal-info)]",
        /* LEGADO: funciona e não é o caminho novo. Nem status, nem desabilitado. */
        legacy: "bg-[var(--legacy-bg)] text-[var(--legacy)]",
        /* ÊNFASE (rust): marca sem julgar — valor ausente, modo profundo, o que
           veio da mão de uma pessoa. Nunca status. */
        emphasis:
          "bg-[var(--nexodoc-tertiary-bg)] text-[var(--nexodoc-tertiary)]",
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
