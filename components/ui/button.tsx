import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  /*
   * Rótulo em Mono Data (13px + 0.02em), não em 14px: a escala mono do sistema
   * tem dois degraus (rótulo 12, dado 13) e 14 não é nenhum deles.
   *
   * A transição usa os TOKENS de movimento. Antes era `duration-150 ease-out`,
   * dois valores soltos que ninguém conseguia mudar em um lugar só — e o botão
   * respondia 30ms mais devagar que todo o resto da interface.
   */
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-mono text-[13px] font-medium tracking-[0.02em] transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-feedback)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 outline-none focus-visible:border-ring focus-visible:ring-ring/25 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default:
          "border border-primary bg-primary text-primary-foreground shadow-[var(--edge-highlight)] hover:bg-primary/90",
        destructive:
          "border border-destructive/35 bg-destructive text-[var(--destructive-foreground)] hover:bg-destructive/90 focus-visible:ring-destructive/20",
        /* Borda de CAMPO (#2c3338), não a estrutural (#23282c): o contorno
           precisa se ler como controle, e a borda de painel some no escuro. */
        outline:
          "border border-input bg-card text-foreground hover:border-ring hover:bg-accent hover:text-accent-foreground",
        secondary:
          "border border-ring/35 bg-secondary text-secondary-foreground shadow-[var(--edge-highlight)] hover:border-ring hover:bg-accent",
        ghost: "border border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
