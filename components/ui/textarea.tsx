import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Mesma exceção do Input: `textarea` nativo nao renderiza `::before`, entao a
 * camada de contorno mora num wrapper. `className` vai para o wrapper; para
 * mexer na area de digitacao em si, use `textareaClassName`.
 */
function Textarea({
  className,
  textareaClassName,
  ...props
}: React.ComponentProps<"textarea"> & { textareaClassName?: string }) {
  return (
    <div className={cn("nx-edge-7 min-h-16 [--nx-edge:var(--input)] [--nx-fill:var(--nexodoc-recessed)]", className)}>
      <textarea
        data-slot="textarea"
        className={cn(
          "size-full min-h-[inherit] resize-none border-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          textareaClassName,
        )}
        {...props}
      />
    </div>
  );
}

export { Textarea };
