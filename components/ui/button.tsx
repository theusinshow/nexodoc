import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/35 focus-visible:ring-[2px] active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "border border-primary/45 bg-primary text-primary-foreground shadow-[0_1px_0_rgb(255_255_255_/_0.18)_inset] hover:bg-primary/90",
        destructive:
          "border border-destructive/35 bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border bg-[var(--nexodoc-raised)] text-foreground hover:border-ring hover:bg-accent hover:text-accent-foreground",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "border border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6",
        icon: "size-9",
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
