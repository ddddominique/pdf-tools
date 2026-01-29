import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
  {
    variants: {
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2",
        lg: "h-10 px-3",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

export interface ToggleProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof toggleVariants> {
  pressed?: boolean;
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, pressed, size, ...props }, ref) => (
    <button
      type="button"
      ref={ref}
      data-state={pressed ? "on" : "off"}
      className={cn(toggleVariants({ size, className }))}
      aria-pressed={pressed}
      {...props}
    />
  )
);
Toggle.displayName = "Toggle";

export { Toggle };
