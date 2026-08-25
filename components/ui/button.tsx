import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * O chanfro (docs/superpowers/specs/2026-08-11-chanfro-como-sistema-design.md).
 *
 * Tres camadas, nenhuma delas markup -- condicao para o `asChild` do Radix
 * continuar funcionando, ja que o Slot nao aceita filho extra:
 *   elemento   a cor da borda; vira --ring no :focus-visible
 *   ::before   o miolo; recua de 1px para 3px no foco; carrega o ponto de canto
 *   ::after    a lamina
 * Tudo isso vive em `.nx-edge-*` / `.nx-ctl` / `.nx-dot` no globals.css. Aqui so
 * escolhemos o corte e passamos as cores por --nx-edge / --nx-fill / --nx-blade.
 *
 * O `min-h-10` da base SAIU: era ele que apagava a hierarquia de tamanho, e sem
 * isso as tres alturas nao coexistem numa mesma tela (criterio 04).
 *
 * A fonte e IBM Plex Mono (`font-mono`), nao Geist -- o handoff cita Geist
 * porque e o tipo do documento de design, e a spec fecha que tipografia nao muda.
 */
const buttonVariants = cva(
  "nx-ctl relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border-0 font-mono font-semibold uppercase tracking-[0.06em] outline-none transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-feedback)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4",
  {
    variants: {
      variant: {
        /* Repouso CHAPADO: a moldura tem a mesma cor do miolo, entao nao se ve
           contorno nenhum -- mas a camada existe, e e ela que vira o anel de
           foco. Substitui o `hover:bg-primary/90`, que enfraquecia o botao. */
        default:
          "text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.22)] [--nx-edge:var(--primary)] [--nx-fill:var(--primary)] [--nx-blade:var(--blade-on-primary)] hover:[--nx-edge:var(--primary-hover)] hover:[--nx-fill:var(--primary-hover)] active:shadow-[inset_0_2px_3px_rgb(0_0_0/0.35)] active:[--nx-edge:var(--primary-active)] active:[--nx-fill:var(--primary-active)]",
        destructive:
          "text-[var(--destructive-foreground)] [--nx-edge:var(--destructive)] [--nx-fill:var(--destructive)] [--nx-blade:var(--blade-on-destructive)]",
        /* Secundaria e outline sao a mesma camada com miolos diferentes:
           #2c3338 (--input) por fora, #1a1e21 (--secondary) ou --card por dentro. */
        outline:
          "nx-dot text-foreground [--nx-edge:var(--input)] [--nx-fill:var(--card)] [--nx-blade:var(--blade-on-secondary)] hover:[--nx-edge:var(--ring)]",
        secondary:
          "nx-dot text-secondary-foreground [--nx-edge:var(--input)] [--nx-fill:var(--secondary)] [--nx-blade:var(--blade-on-secondary)] hover:[--nx-edge:var(--ring)]",
        /* A UNICA VARIANTE QUE NAO TINHA ESTADO NENHUM. Nem hover, nem active,
           nem lamina -- passar o mouse no botao de entrar nao devolvia nada, e
           ele e o unico controle da tela de login.

           A escada corre para o BRANCO no hover e para baixo no active -- o
           inverso da teal, porque a superficie e clara. Os tres valores e a
           lamina moram em `--google-*` / `--blade-on-google`, e o comentario
           deles no `globals.css` conta por que sao esses e nao outros. */
        google:
          "font-sans text-sm font-medium normal-case tracking-normal text-background shadow-[inset_0_1px_0_rgb(255_255_255/0.55)] [--nx-edge:var(--foreground)] [--nx-fill:var(--foreground)] [--nx-blade:var(--blade-on-google)] hover:[--nx-edge:var(--google-hover)] hover:[--nx-fill:var(--google-hover)] active:shadow-[inset_0_2px_3px_rgb(0_0_0/0.26)] active:[--nx-edge:var(--google-active)] active:[--nx-fill:var(--google-active)]",
        /* Sem forma: so texto. A camada continua existindo (transparente) para o
           anel de foco ter onde aparecer -- mas o miolo TEM de ficar opaco no
           foco: transparente ele nao mascara nada, e o botao virava um bloco
           teal solido com o rotulo cinza por cima, em vez de um anel. */
        ghost:
          "text-muted-foreground [--nx-edge:transparent] [--nx-fill:transparent] hover:text-foreground hover:[--nx-fill:var(--accent)] focus-visible:[--nx-fill:var(--accent)]",
      },
      size: {
        lg: "nx-edge-8 h-11 px-[22px] text-[12px]",
        default: "nx-edge-7 h-10 px-[18px] text-[12px]",
        sm: "nx-edge-6 h-8 px-[14px] text-[11px]",
        icon: "nx-edge-7 size-10 px-0",
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
  loading = false,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /* Carregando nao tem spinner: a lamina entra em laco e o fundo desce um
       degrau. Um spinner dentro de forma recortada briga com o chanfro. */
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-loading={loading ? "true" : undefined}
      disabled={disabled ?? (loading || undefined)}
      className={cn(
        buttonVariants({ variant, size }),
        loading && "[--nx-edge:var(--primary-active)] [--nx-fill:var(--primary-active)]",
        className,
      )}
      {...props}
    />
  );
}

export { Button, buttonVariants };
