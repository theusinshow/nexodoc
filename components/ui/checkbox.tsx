import * as React from "react";

import { cn } from "@/lib/utils";

// Input nativo com aparencia zerada: mantem semantica, teclado e :focus-visible
// de graca, sem dependencia extra. Sem isso o navegador desenha o checkbox com
// o azul do sistema, que o DESIGN.md proibe.
function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "relative size-4 shrink-0 appearance-none border border-input bg-background transition-colors outline-none",
        "checked:border-primary checked:bg-primary",
        // O check e desenhado em ::after para nao exigir um filho no DOM.
        "after:absolute after:left-1/2 after:top-1/2 after:h-[8px] after:w-[4px] after:-translate-x-1/2 after:-translate-y-[60%]",
        "after:rotate-45 after:border-b-2 after:border-r-2 after:border-primary-foreground after:opacity-0 after:content-['']",
        "checked:after:opacity-100",
        "indeterminate:border-primary indeterminate:bg-primary",
        "indeterminate:after:h-0 indeterminate:after:w-[8px] indeterminate:after:-translate-y-1/2 indeterminate:after:rotate-0",
        "indeterminate:after:border-b-2 indeterminate:after:border-r-0 indeterminate:after:opacity-100",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
