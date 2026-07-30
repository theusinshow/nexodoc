import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Chip — `<button>` real, matte, em forma de pílula. Base compartilhada pelas
 * pré-respostas do agente (QuickReplyChips) e pelos chips "alterar <slot>" do
 * ConfirmationCard. NUNCA é um formulário: um chip é sempre uma AÇÃO conversacional
 * (escrever no composer ou enviar). Dado é matte (§6 da ARQUITETURA.md), então o
 * chip não usa glass — vidro fica pro chrome ambiente do PR5.
 *
 * Variantes por INTENÇÃO, não por cor:
 * - `suggest`: pré-resposta recomendada (a 1ª do slot). Só um FIO teal na borda —
 *   nada de preenchimento/texto verde (preto-forward, verde só na ação primária).
 * - `default`: pré-resposta comum / opção de fluxo.
 * - `quiet`: correção ("alterar título") — mais apagado, secundário ao card.
 */
const chipVariants = cva(
  /* Transição pelos tokens de movimento (era `duration-150 ease-out`, solto). */
  "inline-flex min-h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 font-mono text-xs font-medium tracking-[0.02em] transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-feedback)] outline-none focus-visible:border-ring focus-visible:ring-ring/25 focus-visible:ring-[3px] active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:opacity-70",
  {
    variants: {
      variant: {
        /*
         * Fundo `secondary` (#1a1e21), não `card`: o chip fica SOBRE a bolha e
         * sobre o palco, e no fundo de cartão ele desaparecia dentro deles.
         * O fio do sugerido usa o teal CLARO a 45% — o escuro a 30% não se via.
         */
        suggest:
          "border-[var(--ring)]/45 bg-secondary text-foreground hover:border-[var(--ring)]/70 hover:bg-accent",
        default:
          "border-border bg-secondary text-foreground hover:border-input hover:bg-accent hover:text-accent-foreground",
        quiet:
          "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Chip({
  className,
  variant,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof chipVariants>) {
  return (
    <button
      type={type}
      data-slot="chip"
      className={cn(chipVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Chip, chipVariants };
