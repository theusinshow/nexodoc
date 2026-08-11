import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Campo com chanfro — a UNICA exceção que ainda usa wrapper de verdade.
 *
 * `input` nativo nao renderiza `::before`, entao a camada de contorno nao cabe
 * dentro dele como cabe no Button e no Card. O wrapper `.nx-edge-7` desenha a
 * borda, o miolo e o anel de foco (por `:has(:focus-visible)`, que ve o foco do
 * filho); o campo por dentro fica transparente e sem borda.
 *
 * `className` vai para o WRAPPER: e ele que ocupa espaco no layout. Para mexer
 * no campo em si, use `inputClassName`.
 */
function Input({
  className,
  inputClassName,
  type,
  ...props
}: React.ComponentProps<"input"> & { inputClassName?: string }) {
  return (
    <div className={cn("nx-edge-7 h-10 [--nx-edge:var(--input)] [--nx-fill:var(--nexodoc-recessed)]", className)}>
      <input
        type={type}
        data-slot="input"
        className={cn(
          "size-full min-w-0 border-0 bg-transparent px-3 py-1 text-sm outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          inputClassName,
        )}
        {...props}
      />
    </div>
  );
}

export { Input };
