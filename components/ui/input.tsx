import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // h-10 explicito: alinha com o Button (min-h-10) em linhas de form; o
        // min-height:2.5rem global ja forcava 40px, entao o h-9 era classe morta.
        // Fundo recessed (#06080a) da o efeito inset da DESIGN.md; focus ring
        // unificado com o Button (ring-[3px] /25).
        "h-10 w-full min-w-0 border border-input bg-[var(--nexodoc-recessed)] px-3 py-1 text-sm transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-feedback)] outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
