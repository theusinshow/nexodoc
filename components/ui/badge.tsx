import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 font-mono text-xs font-medium leading-none transition-colors",
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
