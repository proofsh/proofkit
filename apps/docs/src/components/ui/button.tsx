import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/80",
  outline: "border hover:bg-fd-accent hover:text-fd-accent-foreground",
  ghost: "hover:bg-fd-accent hover:text-fd-accent-foreground",
  secondary: "border bg-fd-secondary text-fd-secondary-foreground hover:bg-fd-accent hover:text-fd-accent-foreground",
} as const;

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md p-2 font-medium text-sm transition-colors duration-100 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: variants,
      color: variants,
      size: {
        sm: "gap-1 px-2 py-1.5 text-xs",
        icon: "p-1.5 [&_svg]:size-5",
        "icon-sm": "p-1.5 [&_svg]:size-4.5",
        "icon-xs": "p-1 [&_svg]:size-4",
      },
    },
  },
);

type ButtonProps = VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, ...props }: React.ComponentProps<"button"> & ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants, type ButtonProps };
