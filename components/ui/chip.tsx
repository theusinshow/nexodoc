import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Chip — `<button>` real, matte, com o chanfro de 6px do sistema. Era pílula
 * (`rounded-full`) até a spec do chanfro; a forma passou a ser a mesma de todo
 * controle, porque duas geometrias competindo na mesma tela não são um sistema.
 * Base compartilhada pelas
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
  "nx-edge-6 inline-flex min-h-8 shrink-0 items-center gap-2 whitespace-nowrap border-0 px-3 py-1 font-mono text-xs font-medium tracking-[0.02em] transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-feedback)] outline-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:opacity-70",
  {
    variants: {
      variant: {
        /*
         * Fundo `secondary` (#1a1e21), não `card`: o chip fica SOBRE a bolha e
         * sobre o palco, e no fundo de cartão ele desaparecia dentro deles.
         * O fio do sugerido usa o teal CLARO a 45% — o escuro a 30% não se via.
         */
        suggest:
          "text-foreground [--nx-edge:rgb(91_218_198/0.45)] [--nx-fill:var(--secondary)] hover:[--nx-edge:rgb(91_218_198/0.7)] hover:[--nx-fill:var(--accent)]",
        default:
          "text-foreground [--nx-edge:var(--border)] [--nx-fill:var(--secondary)] hover:[--nx-edge:var(--input)] hover:[--nx-fill:var(--accent)]",
        quiet:
          "text-muted-foreground [--nx-edge:transparent] [--nx-fill:transparent] hover:text-foreground hover:[--nx-edge:var(--border)] hover:[--nx-fill:var(--accent)]",
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
