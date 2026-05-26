import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-mono text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out disabled:pointer-events-none disabled:opacity-45 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 outline-none focus-visible:border-ring focus-visible:ring-ring/25 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default:
          "border border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "border border-destructive/35 bg-destructive text-[var(--destructive-foreground)] hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border bg-card text-foreground hover:border-ring hover:bg-accent hover:text-accent-foreground",
        secondary:
          "border border-ring/35 bg-secondary text-secondary-foreground hover:border-ring hover:bg-accent",
        ghost: "border border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "size-10",
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
