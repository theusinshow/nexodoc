import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Seletor com chanfro — o último móvel do cômodo antigo.
 *
 * Havia ONZE `<select>` nativos espalhados pelo produto, com `rounded-md` e
 * borda padrão, num sistema cuja geometria declarada é o chanfro (§5). Eles
 * eram a única coisa da tela que ainda falava a língua anterior, e apareciam
 * em quatro telas do admin — a tela de quem paga a conta.
 *
 * O ELEMENTO NATIVO FICA, e essa é a decisão central. O defeito apurado foi de
 * APARÊNCIA, não de comportamento: o `<select>` entrega navegação por teclado,
 * leitura correta por leitor de tela e o seletor nativo do celular sem custo
 * nenhum. Uma lista customizada trocaria um problema visual por um problema de
 * acesso — e serviria pior exatamente quem mais depende dele.
 *
 * Mesmo idioma do `Input`: o wrapper `.nx-edge-7` desenha a borda, o miolo e o
 * anel de foco (por `:has(:focus-visible)`); o campo por dentro fica
 * transparente e sem borda. `className` vai para o WRAPPER, que é quem ocupa
 * espaço no layout.
 *
 * `color-scheme: dark` NÃO é detalhe: a lista de opções é desenhada pelo
 * sistema operacional, não por nós, e sem isso ela abre BRANCA por cima de um
 * produto escuro. Fica aqui, e não global, para o raio de alcance ser este
 * componente — mudar o esquema do documento inteiro mexeria também em barra de
 * rolagem e em todo controle nativo, o que é outra decisão.
 */
function Select({
  className,
  selectClassName,
  children,
  ...props
}: React.ComponentProps<"select"> & { selectClassName?: string }) {
  return (
    <div
      className={cn(
        "nx-edge-7 relative h-10 [--nx-edge:var(--input)] [--nx-fill:var(--nexodoc-recessed)]",
        className,
      )}
    >
      <select
        data-slot="select"
        className={cn(
          // `appearance-none` tira a seta do sistema; a nossa entra abaixo, e
          // o `pr-9` é o espaço que ela ocupa.
          "size-full min-w-0 appearance-none border-0 bg-transparent pl-3 pr-9 text-sm outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          selectClassName,
        )}
        style={{ colorScheme: "dark" }}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { Select };
