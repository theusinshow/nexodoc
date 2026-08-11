import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { flat?: boolean }
>(({ className, flat = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      /*
       * DESIGN.md secao 4: FLAT POR PADRAO -- profundidade vem de borda + tom de
       * superficie, nunca de sombra.
       *
       * O CSS do sistema v0 poe `box-shadow: var(--edge-highlight)` no `.card`
       * em repouso. NAO adotado: a regra do repositorio limita o fio de luz a
       * superficie elevada ou interativa (botao, cartao em hover, sobreposicao)
       * e o proibe em painel plano parado. Divergencia registrada no lote 3.
       *
       * O raio de 8px virou chanfro de 8px (spec do chanfro). Com contorno, a
       * borda e o fundo do proprio elemento e o miolo e o ::before -- `border`
       * nao sobrevive ao recorte nas diagonais. Sem contorno (`flat`), uma forma
       * so: camada externa sem necessidade e desperdicio de pintura.
       */
      flat ? "nx-cut-8 bg-card" : "nx-edge-8",
      "text-card-foreground",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-4", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-medium leading-tight tracking-[-0.01em]", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-4 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
